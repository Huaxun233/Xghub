package core

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/anacrolix/torrent/storage"
)

const (
	torrentInfoTimeout    = 2 * time.Minute
	torrentReadaheadBytes = 24 << 20
	torrentVideoMinBytes  = 8 << 20
)

type torrentStream struct {
	mu      sync.Mutex
	client  *torrent.Client
	active  *torrent.Torrent
	reader  torrent.Reader
	file    *torrent.File
	started time.Time
	infoErr error
}

type torrentRegistry struct {
	mu        sync.Mutex
	streams   map[string]*torrentStream
	directory string
}

var torrentStreams = &torrentRegistry{streams: map[string]*torrentStream{}}

func torrentDisplayName(name string) string {
	return filepath.Base(strings.ReplaceAll(name, "\\", "/"))
}

func torrentIsVideoFile(file *torrent.File) bool {
	extension := strings.ToLower(filepath.Ext(file.DisplayPath()))
	switch extension {
	case ".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".ts", ".flv", ".wmv", ".mpg", ".mpeg", ".m2ts":
		return file.Length() >= torrentVideoMinBytes
	}
	return false
}

func torrentPickFile(t *torrent.Torrent) *torrent.File {
	files := t.Files()
	if len(files) == 0 {
		return nil
	}
	video := make([]*torrent.File, 0, len(files))
	for _, file := range files {
		if torrentIsVideoFile(file) {
			video = append(video, file)
		}
	}
	if len(video) == 0 {
		for _, file := range files {
			if file.Length() >= torrentVideoMinBytes {
				video = append(video, file)
			}
		}
	}
	if len(video) == 0 {
		for _, file := range files {
			if file.Length() > 0 {
				video = append(video, file)
			}
		}
	}
	sort.SliceStable(video, func(i, j int) bool { return video[i].Length() > video[j].Length() })
	if len(video) == 0 {
		return nil
	}
	return video[0]
}

func (registry *torrentRegistry) stream(sessionToken, magnet string, cacheDirectory string) (*torrentStream, error) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if existing := registry.streams[sessionToken]; existing != nil {
		return existing, nil
	}
	directory := filepath.Join(cacheDirectory, "torrents")
	if err := os.MkdirAll(directory, 0700); err != nil {
		return nil, errors.New("无法创建 BT 缓存目录")
	}
	config := torrent.NewDefaultClientConfig()
	config.DataDir = directory
	config.DefaultStorage = storage.NewFileByInfoHash(directory)
	config.NoDHT = false
	config.Debug = false
	client, err := torrent.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("无法启动 BT 引擎：%w", err)
	}
	stream := &torrentStream{client: client, started: time.Now()}
	registry.streams[sessionToken] = stream
	if _, err := metainfo.ParseMagnetURI(magnet); err != nil {
		stream.closeLocked()
		delete(registry.streams, sessionToken)
		return nil, fmt.Errorf("无法解析磁力链：%w", err)
	}
	t, err := client.AddMagnet(magnet)
	if err != nil {
		stream.closeLocked()
		delete(registry.streams, sessionToken)
		return nil, fmt.Errorf("无法解析磁力链：%w", err)
	}
	stream.active = t
	go func() {
		select {
		case <-t.GotInfo():
			stream.mu.Lock()
			stream.infoErr = nil
			stream.mu.Unlock()
		case <-time.After(torrentInfoTimeout):
			stream.mu.Lock()
			stream.infoErr = errors.New("获取 BT 种子信息超时（trackers 不可用或资源无做种）")
			stream.mu.Unlock()
		}
	}()
	return stream, nil
}

func (registry *torrentRegistry) release(sessionToken string) {
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if stream := registry.streams[sessionToken]; stream != nil {
		stream.closeLocked()
		delete(registry.streams, sessionToken)
	}
}

func (stream *torrentStream) closeLocked() {
	if stream.reader != nil {
		_ = stream.reader.Close()
		stream.reader = nil
	}
	if stream.client != nil {
		_ = stream.client.Close()
		stream.client = nil
	}
}

// torrentReady waits for metadata and prepares the largest video file reader.
func (stream *torrentStream) torrentReady() (*torrent.Torrent, *torrent.File, error) {
	stream.mu.Lock()
	defer stream.mu.Unlock()
	if stream.client == nil {
		return nil, nil, errors.New("BT 播放已结束")
	}
	if stream.file != nil && stream.reader != nil {
		return stream.active, stream.file, nil
	}
	select {
	case <-stream.active.GotInfo():
	case <-time.After(torrentInfoTimeout):
		if stream.infoErr != nil {
			return nil, nil, stream.infoErr
		}
		return nil, nil, errors.New("获取 BT 种子信息超时（trackers 不可用或资源无做种）")
	}
	file := torrentPickFile(stream.active)
	if file == nil {
		return nil, nil, errors.New("种子中没有可播放的视频文件")
	}
	reader := file.NewReader()
	reader.SetReadahead(torrentReadaheadBytes)
	reader.SetResponsive()
	stream.reader = reader
	stream.file = file
	return stream.active, file, nil
}

func (stream *nativeStreamServer) nativeOpenTorrent(source string, media ProviderMedia, cacheDirectory string) (string, string) {
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		panic(err)
	}
	token := hex.EncodeToString(tokenBytes)
	ctx, cancel := context.WithCancel(providerMediaContext(context.Background(), media.Credentials))
	session := &nativeStreamSession{assets: map[string]nativeStreamAsset{}, referer: media.Referer, ctx: ctx, cancel: cancel, lastUsed: time.Now(), credentials: media.Credentials, source: source, diagnosticID: nativeStreamID(token)}
	stream.mu.Lock()
	for id, old := range stream.sessions {
		if time.Since(old.lastUsed) > 10*time.Minute {
			stream.nativeCancel(old, "idle_expired")
			delete(stream.sessions, id)
		}
	}
	if len(stream.sessions) >= 8 {
		oldest := ""
		for id, old := range stream.sessions {
			if oldest == "" || old.lastUsed.Before(stream.sessions[oldest].lastUsed) {
				oldest = id
			}
		}
		stream.nativeCancel(stream.sessions[oldest], "capacity_eviction")
		delete(stream.sessions, oldest)
	}
	stream.sessions[token] = session
	stream.mu.Unlock()
	entry := nativeStreamAsset{kind: "torrent", address: media.URL, contentType: "video/mp4"}
	address := stream.nativeAsset(token, session, entry)
	go func() {
		<-session.ctx.Done()
		torrentStreams.release(token)
	}()
	return address, token
}

func (stream *nativeStreamServer) torrentServe(writer http.ResponseWriter, request *http.Request, session *nativeStreamSession, asset nativeStreamAsset, info nativeStreamDiagnostic) {
	streamSession, err := torrentStreams.stream(session.diagnosticID, asset.address, stream.cacheDirectory)
	if err != nil {
		stream.nativeLog(info, "torrent_open", "", nativeStreamError(err), 0, "")
		http.Error(writer, err.Error(), http.StatusBadGateway)
		return
	}
	_, file, err := streamSession.torrentReady()
	if err != nil {
		name := ""
		if file != nil {
			name = file.DisplayPath()
		}
		stream.nativeLog(info, "torrent_info", name, nativeStreamError(err), 0, "")
		http.Error(writer, err.Error(), http.StatusServiceUnavailable)
		return
	}
	reader := streamSession.reader
	if reader == nil {
		http.Error(writer, "BT 播放已结束", http.StatusGone)
		return
	}
	stream.nativeLog(info, "torrent_serve", file.DisplayPath(), fmt.Sprintf("size=%d", file.Length()), 0, "")
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Accept-Ranges", "bytes")
	http.ServeContent(writer, request, torrentDisplayName(file.DisplayPath()), time.Time{}, &torrentSectionReader{reader: reader, size: file.Length()})
}

// torrentSectionReader adapts torrent.Reader (Seek/Read only, no ReadAt) to
// io.ReaderAt for http.ServeContent Range support. Not safe for concurrent
// reads, which matches how ServeContent uses the reader.
type torrentSectionReader struct {
	reader torrent.Reader
	offset int64
	size   int64
}

func (r *torrentSectionReader) Read(buffer []byte) (int, error) {
	return r.ReadAt(buffer, r.offset)
}

func (r *torrentSectionReader) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case io.SeekStart:
	case io.SeekCurrent:
		offset += r.offset
	case io.SeekEnd:
		offset += r.size
	default:
		return 0, errors.New("torrentSectionReader: invalid whence")
	}
	if offset < 0 {
		return 0, errors.New("torrentSectionReader: negative position")
	}
	r.offset = offset
	return offset, nil
}

func (r *torrentSectionReader) ReadAt(buffer []byte, offset int64) (int, error) {
	if offset < 0 || offset >= r.size {
		return 0, io.EOF
	}
	if _, err := r.reader.Seek(offset, io.SeekStart); err != nil {
		return 0, err
	}
	if remaining := r.size - offset; int64(len(buffer)) > remaining {
		buffer = buffer[:remaining]
	}
	total := 0
	for total < len(buffer) {
		read, err := r.reader.Read(buffer[total:])
		total += read
		if err != nil {
			return total, err
		}
	}
	r.offset += int64(total)
	return total, nil
}

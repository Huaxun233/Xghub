package core

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const cmsConfigBytes = 4 << 20

// looksLikeHTML 判断拉到的内容是否是网页（劫持页/错误页）。
func looksLikeHTML(raw []byte) bool {
	head := strings.ToLower(strings.TrimSpace(string(raw[:min(len(raw), 256)])))
	return strings.HasPrefix(head, "<!doctype html") || strings.HasPrefix(head, "<html") || strings.Contains(head, "<head")
}

// cmsSite 是 TVBox 配置里一个 CMS 资源站点。
type cmsSite struct {
	Key        string `json:"key"`
	Name       string `json:"name"`
	API        string `json:"api"`
	Type       int    `json:"type"`
	Searchable *bool  `json:"searchable"`

	// 解析结果。
	Format    string `json:"format"` // "json" 或 "xml"
	Reason    string `json:"reason,omitempty"`
	ID        string `json:"id,omitempty"`
	Host      string `json:"host,omitempty"`
	Installed bool   `json:"installed"`
}

type cmsConfig struct {
	Sites []struct {
		Key        string `json:"key"`
		Name       string `json:"name"`
		Type       int    `json:"type"`
		API        string `json:"api"`
		Searchable *bool  `json:"searchable"`
	} `json:"sites"`
}

func cmsModuleID(api string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(api)))
	return "cms-" + hex.EncodeToString(digest[:])[:8]
}

func cmsHostName(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Hostname() == "" {
		return ""
	}
	return strings.ToLower(parsed.Hostname())
}

// parseTVBoxSites 解析 TVBox 配置，返回兼容与不兼容的站点。
func parseTVBoxSites(raw []byte) []cmsSite {
	// 容错：UTF-8 BOM 会让 json.Unmarshal 直接失败。
	trimmed := bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	var config cmsConfig
	if err := json.Unmarshal(trimmed, &config); err != nil {
		summary := "配置不是有效的 TVBox JSON"
		if looksLikeHTML(raw) {
			summary = "拉到的内容是网页而不是 TVBox 配置（可能被运营商劫持，或地址不对）"
		}
		preview := strings.TrimSpace(string(raw))
		if len(preview) > 120 {
			preview = preview[:120] + "…"
		}
		preview = strings.ReplaceAll(preview, "\n", " ")
		return []cmsSite{{Reason: fmt.Sprintf("%s（解析错误：%v；内容开头：%s）", summary, err, preview)}}
	}
	sites := []cmsSite{}
	seen := map[string]bool{}
	for _, entry := range config.Sites {
		name := strings.TrimSpace(entry.Name)
		if name == "" {
			name = strings.TrimSpace(entry.Key)
		}
		site := cmsSite{Key: strings.TrimSpace(entry.Key), Name: name, API: strings.TrimSpace(entry.API), Type: entry.Type, Searchable: entry.Searchable}
		switch site.Type {
		case 0:
			site.Format = "xml"
		case 1:
			site.Format = "json"
		default:
			site.Reason = "不支持的站点类型 " + fmt.Sprint(entry.Type)
			sites = append(sites, site)
			continue
		}
		if site.API == "" {
			site.Reason = "站点缺少接口地址"
			sites = append(sites, site)
			continue
		}
		parsed, err := url.Parse(site.API)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
			site.Reason = "接口地址不是有效的 http(s) 链接"
			sites = append(sites, site)
			continue
		}
		site.Host = strings.ToLower(parsed.Hostname())
		site.ID = cmsModuleID(site.API)
		if seen[site.ID] {
			site.Reason = "与前面的站点接口重复"
			site.ID = ""
			sites = append(sites, site)
			continue
		}
		seen[site.ID] = true
		sites = append(sites, site)
	}
	return sites
}

func cmsModuleManifest(site cmsSite) ([]byte, error) {
	adult := false
	manifest := ModuleManifest{
		ID:          site.ID,
		Name:        site.Name,
		Version:     "1.0.0",
		Description: "CMS 站源导入 · " + site.Host,
		Runtime:     moduleRuntimeJS,
		API:         moduleAPIVersion,
		Hosts:       []string{site.Host},
		Capabilities: []string{
			"search",
		},
		Adult:     &adult,
		Group:     "cms",
		GroupName: "CMS 资源站",
	}
	raw, err := json.Marshal(manifest)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

const cmsModuleTemplate = `var config = CONFIG_VALUE;
function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
function stripTags(value) {
  return text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function apiURL(params) {
  return config.api + (config.api.indexOf("?") >= 0 ? "&" : "?") + params;
}
function request(params) {
  var response = host.fetch({ url: apiURL(params), timeoutMs: 20000 });
  if (response.status < 200 || response.status >= 300) {
    throw new Error("站点返回 HTTP " + response.status);
  }
  return response.body;
}
function requestJSON(params) {
  var body = request(params);
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error("站点返回的不是有效 JSON，请确认接口类型");
  }
}
function findNodes(node, tag, out) {
  var children = (node && node.children) || [];
  for (var i = 0; i < children.length; i += 1) {
    var child = children[i];
    if (child.tag === tag) out.push(child);
    findNodes(child, tag, out);
  }
  return out;
}
function nodeText(node) {
  var out = "";
  var children = (node && node.children) || [];
  for (var i = 0; i < children.length; i += 1) {
    var child = children[i];
    out += typeof child.text === "string" ? child.text : nodeText(child);
  }
  return out;
}
function nodeField(node, tag) {
  var found = findNodes(node, tag, []);
  return found.length ? stripTags(nodeText(found[0])) : "";
}
function xmlDocument(body) {
  return host.parseHtml(body);
}
function playable(url) {
  var value = text(url).toLowerCase();
  return /\.m3u8([?#].*)?$/.test(value) || /\.mp4([?#].*)?$/.test(value);
}
function playGroups(row) {
  var raw = text(row.vod_play_url);
  if (!raw) return [];
  var groups = raw.split("$$$");
  var best = null;
  var fallback = null;
  for (var gi = 0; gi < groups.length; gi += 1) {
    var entries = groups[gi].split("#").filter(function (item) { return text(item); });
    var episodes = [];
    for (var ei = 0; ei < entries.length; ei += 1) {
      var parts = entries[ei].split("$");
      var address = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      if (playable(address)) {
        episodes.push({ title: parts.length > 1 ? parts[0] : "", url: address });
      }
    }
    if (!episodes.length) continue;
    if (!fallback) fallback = episodes;
    var m3u8 = episodes.filter(function (episode) { return /\.m3u8([?#].*)?$/i.test(episode.url.toLowerCase()); }).length;
    if (!best || m3u8 > best.m3u8) best = { m3u8: m3u8, episodes: episodes };
  }
  var chosen = best ? best.episodes : fallback;
  return chosen || [];
}
function dramaOf(row) {
  var title = text(row.vod_name) || "未知影片";
  var sourceId = text(row.vod_id);
  var groups = playGroups(row);
  return {
    id: host.dramaId(sourceId),
    source: host.source,
    sourceId: sourceId,
    title: title,
    name: title,
    cover: text(row.vod_pic),
    desc: stripTags(text(row.vod_content) || text(row.vod_blurb)),
    totalEpisode: groups.length,
    typeName: text(row.type_name),
    remark: text(row.vod_remarks)
  };
}
function chaptersOf(row) {
  var sourceId = text(row.vod_id);
  var groups = playGroups(row);
  var chapters = [];
  var limit = Math.min(groups.length, 2000);
  for (var ei = 0; ei < limit; ei += 1) {
    chapters.push({
      id: host.chapterId(sourceId, "0-" + ei),
      source: host.source,
      title: groups[ei].title || "第 " + (ei + 1) + " 集",
      videoUrl: groups[ei].url,
      currentEpisode: ei + 1
    });
  }
  return chapters;
}
function categories(force) {
  if (config.format === "xml") {
    var doc = xmlDocument(request("ac=list"));
    var classes = findNodes(doc, "class", []);
    var items = [];
    if (classes.length) {
      var types = findNodes(classes[0], "ty", []);
      for (var i = 0; i < types.length; i += 1) {
        var name = stripTags(nodeText(types[i]));
        var id = (types[i].attrs && text(types[i].attrs.id)) || name;
        if (id) items.push({ id: id, name: name || id });
      }
    }
    return items;
  }
  var data = requestJSON("ac=list");
  var rows = (data && data.class) || [];
  return rows.map(function (row) {
    var id = text(row.type_id);
    return { id: id, name: text(row.type_name) || id };
  }).filter(function (item) { return item.id; });
}
function catalogPage(page, category) {
  var params = "ac=detail&pg=" + page;
  if (category) params += "&t=" + encodeURIComponent(category);
  if (config.format === "xml") {
    var doc = xmlDocument(request(params));
    var lists = findNodes(doc, "list", []);
    var videos = lists.length ? findNodes(lists[0], "video", []) : [];
    var items = [];
    for (var i = 0; i < videos.length; i += 1) {
      var video = videos[i];
      items.push(dramaOf({
        vod_id: nodeField(video, "id"),
        vod_name: nodeField(video, "name"),
        vod_pic: nodeField(video, "pic"),
        vod_content: nodeField(video, "des"),
        vod_remarks: nodeField(video, "note"),
        type_name: nodeField(video, "type"),
        vod_play_url: (function () {
          var groups = [];
          var dl = findNodes(video, "dl", []);
          if (dl.length) {
            var dd = findNodes(dl[0], "dd", []);
            for (var di = 0; di < dd.length; di += 1) groups.push(nodeText(dd[di]));
          }
          return groups.join("$$$");
        })()
      }));
    }
    var pagecount = lists.length && lists[0].attrs ? parseInt(text(lists[0].attrs.pagecount), 10) : 0;
    return { items: items, hasMore: pagecount > page };
  }
  var data = requestJSON(params);
  var rows = (data && data.list) || [];
  var pagecount = parseInt(text(data && data.pagecount), 10) || 0;
  return { items: rows.map(dramaOf), hasMore: pagecount > page };
}
function search(page, query) {
  var params = "ac=detail&wd=" + encodeURIComponent(query) + "&pg=" + page;
  var data = requestJSON(params);
  var rows = (data && data.list) || [];
  var pagecount = parseInt(text(data && data.pagecount), 10) || 0;
  return { items: rows.map(dramaOf), hasMore: pagecount > page };
}
function detail(sourceId) {
  var params = "ac=detail&ids=" + encodeURIComponent(sourceId);
  var row;
  if (config.format === "xml") {
    var doc = xmlDocument(request(params));
    var videos = findNodes(doc, "video", []);
    if (!videos.length) throw new Error("站点没有返回影片详情");
    var video = videos[0];
    row = {
      vod_id: nodeField(video, "id"),
      vod_name: nodeField(video, "name"),
      vod_pic: nodeField(video, "pic"),
      vod_content: nodeField(video, "des"),
      vod_remarks: nodeField(video, "note"),
      type_name: nodeField(video, "type"),
      vod_play_url: (function () {
        var groups = [];
        var dl = findNodes(video, "dl", []);
        if (dl.length) {
          var dd = findNodes(dl[0], "dd", []);
          for (var di = 0; di < dd.length; di += 1) groups.push(nodeText(dd[di]));
        }
        return groups.join("$$$");
      })()
    };
  } else {
    var data = requestJSON(params);
    var rows = (data && data.list) || [];
    if (!rows.length) throw new Error("站点没有返回影片详情");
    row = rows[0];
  }
  return { drama: dramaOf(row), chapters: chaptersOf(row) };
}
function resolveMedia(task) {
  var address = task && task.chapter && task.chapter.videoUrl;
  if (!text(address)) throw new Error("本集没有可播放的地址");
  return { url: address };
}
module.exports = { categories: categories, catalogPage: catalogPage, search: search, detail: detail, resolveMedia: resolveMedia };
`

func cmsModuleCode(site cmsSite) ([]byte, error) {
	config, err := json.Marshal(map[string]string{"api": site.API, "format": site.Format})
	if err != nil {
		return nil, err
	}
	return []byte(strings.Replace(cmsModuleTemplate, "CONFIG_VALUE", string(config), 1)), nil
}

func (engine *nativeEngine) cmsSites(ctx context.Context, address string) ([]cmsSite, error) {
	// 容错：粘贴时常见的多余引号、缺 https:// 前缀。
	address = strings.TrimSpace(strings.Trim(address, "'\"`"))
	if address != "" && !strings.Contains(address, "://") {
		address = "https://" + address
	}
	parsed, err := url.Parse(address)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" {
		return nil, errors.New("请填写以 http:// 或 https:// 开头的站源配置地址")
	}
	raw, err := engine.fetchLimited(ctx, parsed.String(), cmsConfigBytes)
	if err != nil {
		// raw.githubusercontent.com 直连失败时回退 jsdelivr 镜像。
		if mirror := cmsJsdelivrMirror(parsed.String()); mirror != "" {
			if raw2, err2 := engine.fetchLimited(ctx, mirror, cmsConfigBytes); err2 == nil {
				raw, err = raw2, nil
			}
		}
	}
	if err != nil {
		return nil, fmt.Errorf("读取站源配置失败：%w", err)
	}
	sites := parseTVBoxSites(raw)
	if len(sites) == 0 {
		return nil, errors.New("配置里没有可用站点")
	}
	// 拉到的不是 TVBox JSON（比如运营商劫持页/登录页）时，把真实原因当错误报出来，
	// 而不是在界面上误导为「没有兼容的 CMS 站点」。
	if len(sites) == 1 && sites[0].Key == "" && sites[0].API == "" && sites[0].Reason != "" {
		return nil, errors.New(sites[0].Reason)
	}
	return sites, nil
}

// cmsJsdelivrMirror 把 raw.githubusercontent.com 地址映射成 cdn.jsdelivr.net 镜像，
// 只处理 /{owner}/{repo}/{branch}/{path…} 形式。
func cmsJsdelivrMirror(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Hostname() != "raw.githubusercontent.com" {
		return ""
	}
	parts := strings.SplitN(strings.TrimPrefix(parsed.Path, "/"), "/", 4)
	if len(parts) < 4 {
		return ""
	}
	owner, repo, branch, rest := parts[0], parts[1], parts[2], parts[3]
	if owner == "" || repo == "" || branch == "" {
		return ""
	}
	return "https://cdn.jsdelivr.net/gh/" + owner + "/" + repo + "@" + branch + "/" + rest
}

func (engine *nativeEngine) cmsProbe(ctx context.Context, address string) (map[string]any, error) {
	sites, err := engine.cmsSites(ctx, address)
	if err != nil {
		return nil, err
	}
	for index := range sites {
		site := &sites[index]
		if site.ID == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(engine.downloader.moduleRoot(), site.ID)); err == nil {
			site.Installed = true
		}
	}
	return map[string]any{"items": sites}, nil
}

type cmsInstallResult struct {
	Key    string `json:"key"`
	Name   string `json:"name"`
	ID     string `json:"id,omitempty"`
	Error  string `json:"error,omitempty"`
	Source string `json:"source,omitempty"`
}

func (engine *nativeEngine) cmsInstall(ctx context.Context, address string, keys []string) (map[string]any, error) {
	sites, err := engine.cmsSites(ctx, address)
	if err != nil {
		return nil, err
	}
	selected := map[string]bool{}
	for _, key := range keys {
		selected[strings.TrimSpace(key)] = true
	}
	installed := []cmsInstallResult{}
	failed := []cmsInstallResult{}
	for _, site := range sites {
		if site.ID == "" || len(keys) > 0 && !selected[site.Key] && !selected[site.ID] {
			continue
		}
		result := cmsInstallResult{Key: site.Key, Name: site.Name, ID: site.ID}
		if err := engine.installCmsModule(site); err != nil {
			result.Error = err.Error()
			failed = append(failed, result)
			continue
		}
		result.Source = site.ID
		installed = append(installed, result)
	}
	if len(installed) == 0 && len(failed) == 0 {
		return nil, errors.New("没有选中任何站点")
	}
	return map[string]any{"installed": installed, "failed": failed, "sources": engine.sourceList()}, nil
}

func (engine *nativeEngine) installCmsModule(site cmsSite) error {
	manifest, err := cmsModuleManifest(site)
	if err != nil {
		return err
	}
	code, err := cmsModuleCode(site)
	if err != nil {
		return err
	}
	module, err := parseModule(manifest, code)
	if err != nil {
		return err
	}
	d := engine.downloader
	loadedModules.Lock()
	defer loadedModules.Unlock()
	if err := moduleConflict(module.manifest); err != nil {
		return err
	}
	if err := d.writeModuleLocked(site.ID, manifest, code); err != nil {
		return err
	}
	if err := d.markBundledRemoved(site.ID, false); err != nil {
		return err
	}
	d.reloadModuleLocked(site.ID)
	if !registeredProviderSource(site.ID) {
		return errors.New("模块已写入但未能加载，详见诊断日志")
	}
	return nil
}

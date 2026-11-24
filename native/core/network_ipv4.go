package core

import (
	"context"
	"net"
	"net/http"
	"sync"
	"time"
)

// 部分移动网络（尤其是家宽/移动数据下的 IPv6 出口）会直接重置 IPv6 连接，
// 表现为 “read tcp [2409:...]->[2606:...]:443: connection reset by peer”。
// 系统解析通常同时拿到 AAAA 与 A 记录，Go 的 Happy Eyeballs 先连 v6 就必然失败。
// 这里让所有对外请求优先连 IPv4，IPv4 全部失败时再退回系统默认拨号。

const ipv4DialCacheTTL = 5 * time.Minute

type ipv4DialCacheEntry struct {
	addresses []string
	expires   time.Time
}

var ipv4DialCache = struct {
	sync.Mutex
	entries map[string]ipv4DialCacheEntry
}{entries: map[string]ipv4DialCacheEntry{}}

func lookupIPv4Addresses(ctx context.Context, host string) []string {
	now := time.Now()
	ipv4DialCache.Lock()
	entry, found := ipv4DialCache.entries[host]
	ipv4DialCache.Unlock()
	if found && now.Before(entry.expires) {
		return entry.addresses
	}
	lookupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	addresses, err := net.DefaultResolver.LookupIP(lookupCtx, "ip4", host)
	if err != nil {
		return nil
	}
	resolved := make([]string, 0, len(addresses))
	for _, address := range addresses {
		if address.To4() == nil {
			continue
		}
		resolved = append(resolved, address.String())
	}
	if len(resolved) == 0 {
		return nil
	}
	ipv4DialCache.Lock()
	ipv4DialCache.entries[host] = ipv4DialCacheEntry{addresses: resolved, expires: now.Add(ipv4DialCacheTTL)}
	ipv4DialCache.Unlock()
	return resolved
}

type ipv4PreferredDialer struct {
	fallback *net.Dialer
	existing func(ctx context.Context, network, address string) (net.Conn, error)
}

func (dialer *ipv4PreferredDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	if network == "tcp" || network == "tcp4" {
		host, port, err := net.SplitHostPort(address)
		if err == nil && host != "" && net.ParseIP(host) == nil {
			for _, resolved := range lookupIPv4Addresses(ctx, host) {
				conn, dialErr := dialer.fallback.DialContext(ctx, "tcp4", net.JoinHostPort(resolved, port))
				if dialErr == nil {
					return conn, nil
				}
			}
		}
	}
	if dialer.existing != nil {
		return dialer.existing(ctx, network, address)
	}
	return dialer.fallback.DialContext(ctx, network, address)
}

// preferIPv4Dial 让 transport 优先使用 IPv4 地址拨号。
func preferIPv4Dial(transport *http.Transport) {
	if transport == nil {
		return
	}
	wrapped := &ipv4PreferredDialer{fallback: &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}}
	if transport.DialContext != nil {
		wrapped.existing = transport.DialContext
	}
	transport.DialContext = wrapped.DialContext
}

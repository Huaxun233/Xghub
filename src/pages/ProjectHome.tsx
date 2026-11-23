import {IAndroid,IWindows,IDownload} from '../icons';
import {useEffect,useRef,useState} from 'react';
import {defaultProjectConfig} from '../projectConfig';
import './ProjectHome.css';
const release='https://github.com/Huaxun233/Xghub/releases/tag/xghub-v2.1.5-121';
export default function ProjectHome(){const [config,setConfig]=useState(defaultProjectConfig);const [playing,setPlaying]=useState(false);const [message,setMessage]=useState('');const [photo,setPhoto]=useState<number|null>(null);const audio=useRef<HTMLAudioElement>(null);
 useEffect(()=>{for(const href of ['/design/motion/motion.css']){if(!document.querySelector('link[href="'+href+'"]')){const e=document.createElement('link');e.rel='stylesheet';e.href=href;document.head.append(e);}}for(const src of ['/design/motion/motion.js','/design/moments/moments.js']){if(!document.querySelector('script[src="'+src+'"]')){const e=document.createElement('script');e.type='module';e.src=src;document.body.append(e);}}},[]);
 useEffect(()=>{let live=true;fetch('/api/project').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(live)setConfig(data.config);}).catch(()=>{if(live)setMessage('暂时无法读取站点设置，已显示默认内容。');});return()=>{live=false;};},[]);
 useEffect(()=>{document.documentElement.classList.add('project-route');document.body.classList.add('project-route');document.title=config.title === '玄果 Xghub' ? 'Huaxun233 · 项目主页' : config.title;document.documentElement.dataset.type='software';const metas=['page-type','site-kind'].map(name=>{const e=document.createElement('meta');e.name=name;e.content='software';document.head.append(e);return e;});return()=>{metas.forEach(e=>e.remove());document.documentElement.classList.remove('project-route');document.body.classList.remove('project-route');delete document.documentElement.dataset.type;};},[config.title]);
 useEffect(()=>{if(audio.current)audio.current.volume=config.music.volume;},[config.music.volume]);
 useEffect(()=>{if(photo===null)return;const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')setPhoto(null);};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[photo]);
 async function music(){if(!audio.current)return;try{if(playing)audio.current.pause();else await audio.current.play();setPlaying(!playing);setMessage('');}catch{setMessage('音乐暂时无法播放，请检查文件地址。');}}
 return <div className={'project-home '+config.theme} style={{'--project-ground':config.backgroundColor} as React.CSSProperties}>
 {config.backgroundImage&&<img className="project-backdrop" src={config.backgroundImage} alt=""/>}
 <header className="project-nav project-wrap"><a className="project-brand" href="/"><img src="/project-icon.svg" width="36" height="36" alt=""/><span>{config.title === "玄果 Xghub" ? "Huaxun233" : config.title}</span></a><nav aria-label="主导航"><a href="#projects">项目</a><a href="#downloads">玄果下载</a><a href="https://github.com/Huaxun233" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
 <main>
  <section className="portfolio-index project-wrap" id="projects" aria-labelledby="projects-title">
    <h1 id="projects-title">我的项目</h1>
    {config.introduction !== defaultProjectConfig().introduction && <p className="project-lead">{config.introduction}</p>}
    <div className="portfolio-grid">
      <article className="portfolio-card">
        <img className="portfolio-icon" src="/project-icon.svg" width="52" height="52" alt=""/>
        <h2>玄果 Xghub</h2>
        <p>影视与漫画客户端。支持管理内容源、搜索作品和使用漫画书架。</p>
        <div className="project-actions">
          <a className="project-button btn" href="/app">打开网页版</a>
          <a className="project-secondary" href="#downloads">下载客户端</a>
          <a className="project-secondary" href="https://github.com/Huaxun233/Xghub">源码 ↗</a>
        </div>
      </article>
      <article className="portfolio-card portfolio-tree">
        <span className="portfolio-icon" aria-hidden="true">🎄</span>
        <h2>圣诞树工作室</h2>
        <p>写一句祝福，上传照片，定制一棵可互动的圣诞树，再把专属链接分享给朋友。</p>
        <div className="project-actions">
          <a className="project-button btn" href="https://christmas-tree-studio.netlify.app">定制圣诞树 ↗</a>
          <a className="project-secondary" href="https://github.com/Huaxun233/christmas-tree-studio">源码 ↗</a>
        </div>
      </article>
    </div>
  </section>
 <section className="project-about" aria-labelledby="about-title"><div className="wrap project-wrap"><div><p className="project-eyebrow">在玄果里</p><h2 id="about-title">从一部影片，<br/>到下一本漫画。</h2></div><div className="project-feature-list"><a href="/app#comics"><img className="app-frame project-app-preview" src="/project-preview.png" alt="玄果漫画网页实际界面" width="1024" height="768" loading="lazy"/></a><article><span>01</span><div><h3>影视</h3><p>客户端管理影视内容与内容源，保留自己的观看方式。</p></div></article><article><span>02</span><div><h3>漫画</h3><p>安装漫画源、搜索内容、收藏书架，再接着读下去。</p></div></article><article><span>03</span><div><h3>浏览器入口</h3><p>无需安装即可打开网页。网页端支持的内容与插件能力以实际页面为准。</p><a href="/app#comics">打开漫画页面 ↗</a></div></article></div></div></section>
 <section className="project-downloads" id="downloads"><div className="wrap project-wrap"><div className="project-section-heading"><p className="project-eyebrow">下载客户端</p><h2>选你的设备。</h2><p>玄果 Xghub 2.1.5</p></div><div className="project-download-grid"><article><IAndroid size={52}/><h3>Android</h3><p>适合大多数新款安卓设备的 ARM64 安装包。</p><a className="project-button btn" href="https://github.com/Huaxun233/Xghub/releases/download/xghub-v2.1.5-121/xghub-2.1.5%2B121-arm64-v8a.apk">下载 APK ↓</a></article><article><IWindows size={52}/><h3>Windows</h3><p>下载安装程序，按提示完成安装。</p><a className="project-button btn" href="https://github.com/Huaxun233/Xghub/releases/download/xghub-v2.1.5-121/xghub-2.1.5%2B121-windows-x64-setup.exe">下载安装包 ↓</a></article><article><IDownload size={52}/><h3>其他版本</h3><p>ARMv7、x86_64、Windows 便携版，以及校验文件。</p><a className="project-secondary" href={release} target="_blank" rel="noreferrer">查看全部文件 ↗</a></article></div><p className="project-download-note">首次安装：下载后打开安装包。升级：使用相同架构的新包覆盖安装，建议先备份自己的内容源配置。</p></div></section>
 {!!config.photos.length&&<section className="project-gallery"><div className="wrap project-wrap"><div className="project-section-heading"><p className="project-eyebrow">来自站长</p><h2>{config.galleryTitle||'照片墙'}</h2></div><div className="project-photo-grid">{config.photos.map((p,i)=><button key={p.id} onClick={()=>setPhoto(i)} aria-label={'查看照片：'+(p.alt||String(i+1))}><img src={p.url} alt={p.alt} loading="lazy"/></button>)}</div></div></section>}
 <section className="project-help" data-moment="word-highlight"><div className="wrap project-wrap"><h2 className="mo-wh__text">从这里开始。</h2><ol><li>下载适合设备的客户端，或打开网页版。</li><li>在内容源设置中添加你使用的源；漫画页支持安装仓库中的漫画源。</li><li>遇到问题时，带上版本和复现步骤，到项目仓库提交 Issue。</li></ol><a className="project-button btn" href="https://github.com/Huaxun233/Xghub#readme" target="_blank" rel="noreferrer">阅读完整使用说明 ↗</a></div></section>
 </main><footer className="project-footer"><div className="wrap project-wrap"><div><a href="https://github.com/Huaxun233" target="_blank" rel="noreferrer">作者主页 ↗</a><a href="/admin">站点管理</a></div><small>玄果 Xghub · 基于 <a href="https://github.com/Xanerix/guoapp">Xanerix/guoapp</a> 与 <a href="https://github.com/Kyosee/VeneraX">Kyosee/VeneraX</a> 改编，源码及许可见仓库。</small></div></footer>
 {config.music.url&&<><audio ref={audio} src={config.music.url} preload="none" onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setMessage('音乐文件无法加载。');}}/><button className="project-music" onClick={()=>void music()} aria-pressed={playing}>{playing?'暂停':'播放'} · {config.music.title||'背景音乐'}</button></>}
 {message&&<p className="project-notice" role="status">{message}</p>}
 {photo!==null&&<div className="project-lightbox" role="dialog" aria-modal="true" aria-label="照片预览" onClick={()=>setPhoto(null)}><button autoFocus onClick={()=>setPhoto(null)}>关闭 ×</button><img src={config.photos[photo].url} alt={config.photos[photo].alt}/></div>}
 </div>;
}


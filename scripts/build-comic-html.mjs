import {build} from 'esbuild';
await build({entryPoints:['scripts/comic-html-entry.mjs'],bundle:true,format:'iife',platform:'browser',minify:true,outfile:'src/comicHtmlBundle.js',legalComments:'inline'});

let mix = require('laravel-mix');
const browserSyncOptions = require(`./bs-config`);

mix
    .js('src/js/app.js', 'public/js/app.js')
    .sass('src/css/app.scss', 'public/css/app.css')
    .browserSync(browserSyncOptions);

mix.options({ processCssUrls: false }).sourceMaps(false, `source-map`);
'use strict';
const path = require('path');
const gulp = require('gulp');
const pkg = require('./package.json');
const $ = require('gulp-load-plugins')();
const gulpSequence = require('gulp-sequence');
const importOnce = require('node-sass-import-once');
const stylemod = require('gulp-style-modules');
const browserSync = require('browser-sync').create();
const gulpif = require('gulp-if');
const combiner = require('stream-combiner2');
const bump = require('gulp-bump');
const argv = require('yargs').argv;
const rename = require('gulp-rename');
const symlink = require("gulp-sym");
const chmod = require('gulp-chmod');
var lazypipe = require('lazypipe');
var htmlmin = require('gulp-htmlmin');
const vulcanize = require('gulp-vulcanize');

const sassOptions = {
  importer: importOnce,
  importOnce: {
    index: true,
    bower: true
  }
};

gulp.task('clean', function() {
  return gulp.src(['.tmp', 'css'], {
    read: false
  }).pipe($.clean());
});

function handleError(err){
  console.log(err.toString());
  this.emit('end');
}

function buildCSS(){
  return combiner.obj([
    $.sass(sassOptions),
    $.autoprefixer({
      browsers: ['last 2 versions', 'Safari 8.0'],
      cascade: false
    }),
    gulpif(!argv.debug, $.cssmin())
  ]).on('error', handleError);
}

gulp.task('sass', function() {
  return gulp.src(['./sass/*.scss'])
    .pipe(buildCSS())
    .pipe(stylemod({
      moduleId: function(file) {
        return path.basename(file.path, path.extname(file.path)) + '-styles';
      }
    }))
    .pipe(gulp.dest('css'))
    .pipe(browserSync.stream({match: 'css/*.html'}));
});

gulp.task('watch', function() {
  gulp.watch(['sass/*.scss'], ['sass']);
});

gulp.task('serve', function() {
  browserSync.init({
    port: 8080,
    notify: false,
    reloadOnRestart: true,
    logPrefix: `${pkg.name}`,
    https: false,
    files: ['*.*'],
    server: ['./', 'bower_components'],
  });

  gulp.watch(['css/*-styles.html', '*.html', 'bower_components/**/*.html']).on('change', browserSync.reload);
  gulp.watch(['sass/*.scss'], ['sass']);

});

gulp.task('bump:patch', function(){
  gulp.src(['./bower.json', './package.json'])
  .pipe(bump({type:'patch'}))
  .pipe(gulp.dest('./'));
});

gulp.task('bump:minor', function(){
  gulp.src(['./bower.json', './package.json'])
  .pipe(bump({type:'minor'}))
  .pipe(gulp.dest('./'));
});

gulp.task('bump:major', function(){
  gulp.src(['./bower.json', './package.json'])
  .pipe(bump({type:'major'}))
  .pipe(gulp.dest('./'));
});

gulp.task('vulcanize', function() {
  return gulp.src('_*.html')
    .pipe(vulcanize({
      abspath: '',
      excludes: ['bower_components/px-theme/px-theme-styles.html'],
      stripComments: true,
      inlineCSS: true,
      inlineScripts: true
    }))
    .pipe(rename(function(path) {
      path.basename = path.basename.substr(1);
    }))
    .pipe(gulp.dest('.'));
});

var buildPipe = lazypipe()
  // inline html imports, scripts and css
  // also remove html comments
  .pipe(function() {
      return rename(function(path) {
      path.basename = path.basename.substr(1);
    });
  })
  .pipe(vulcanize,{
    abspath: '',
    //excludes: ['bower_components/px-theme/px-theme-styles.html'],
    stripComments: true,
    inlineCSS: true,
    inlineScripts: true
  })
  .pipe(htmlmin,{collapseWhitespace: true, removeComments: true, removeEmptyAttributes: true, minifyJS:true, minifyCSS:true})
  .pipe(gulp.dest,'.');


gulp.task('build', function() {
  return gulp.src('_*.html').pipe(buildPipe());
});

// Install the GIT hooks
gulp.task("hooks", function() {
    return gulp.src([ ".git-hooks/post-merge" ])
    .pipe(symlink([".git/hooks/post-merge" ], {
        relative: true,
        force: true
    }));
});

gulp.task('chmod', () => {
  return gulp.src('.git-hooks/*')
    .pipe(chmod(755))
    .pipe(gulp.dest('.git-hooks'));
});

gulp.task('default', function(callback) {
  gulpSequence('clean', 'sass', 'vulcanize')(callback);
});

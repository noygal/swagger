var gulp = require("gulp");
var clean = require("gulp-clean");
var runSequence = require("run-sequence");
var gulpTypings = require("gulp-typings");
var git = require("gulp-git");
var fs = require("fs");
var ts = require('gulp-typescript');
var tsProject = ts.createProject('./tsconfig.json');
var merge = require('merge2');
var del = require('del');

// Clean
gulp.task('clean', function () {
  return del(['build/**/*']);
});


// Install typings.
gulp.task("typings",function(){
  return gulp.src("./typings.json")
    .pipe(gulpTypings());
});

// Build TypeScript.
gulp.task("tsbuild", function(callback) {
  var tsResult = tsProject.src()
    .pipe(ts(tsProject));
  return merge([
    tsResult.dts.pipe(gulp.dest('build/definitions'))
  ]);

});

gulp.task("build", function(callback) {
  runSequence("clean", "typings", "tsbuild", callback);
});

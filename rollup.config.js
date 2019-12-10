import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

export default {
  banner: '// SwiftScroll, copyright (c) jakzo, MIT licensed',
  entry: 'src/swift-scroll.js',
  dest: 'lib/swift-scroll.js',
  format: 'umd',
  sourceMap: true,
  moduleName: 'SwiftScroll',
  plugins: [ babel() /* , uglify({ keep_fnames: true }) */ ]
};

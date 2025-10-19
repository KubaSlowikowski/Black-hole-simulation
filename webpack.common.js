const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: './js/app.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    filename: './js/app.js',
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '' } // copies everything from 'public' to output root
      ]
    })
  ]
};

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * references
 * https://github.com/Devtography/electron-react-typescript-webpack-boilerplate
 */

let common_config = {
  node: {
    __dirname: true
  },
  mode: process.env.ENV || 'development',
  module: {
    rules: [
        {
            test: /\.css$/i,
            use: ["style-loader", "css-loader"],
        },
        {
            test: /\.tsx?$/,
            use: 'babel-loader',
            exclude: [/node_modules/]
        },
        {
            test: /\.(png|jpe?g|gif|svg)$/,
            loader: "file-loader",
            options: {
                esModule: false,
            },
        },
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
};

module.exports = [
  Object.assign({}, common_config, {
    target: 'electron-main',
    entry: {
      renderrer: './src/main/index.ts',
    },
    output: {
      filename: 'main.bundle.js',
      path: path.resolve(__dirname, 'dist')
    },
  }),
  Object.assign({}, common_config, {
    target: 'electron-renderer',
    entry: {
      ui: './src/renderer/index.tsx',
    },
    output: {
      filename: 'renderer.bundle.js',
      path: path.resolve(__dirname, 'dist')
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './public/index.html'),
        })
    ]
  })
]
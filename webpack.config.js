const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * references
 * https://github.com/Devtography/electron-react-typescript-webpack-boilerplate
 */

const isProduction = process.env.NODE_ENV === 'production';

let common_config = {
    // ref: https://github.com/electron/electron/issues/5107#issuecomment-229396204
    node: {
        __dirname: false,
        __filename: false
    },
    devtool: isProduction ? false : 'source-map',
    mode: isProduction ? 'production' : 'development',
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
        entry: './src/main/index.ts',
        output: {
            filename: 'main.bundle.js',
            path: path.resolve(__dirname, 'build')
        },
    }),
    Object.assign({}, common_config, {
        target: 'electron-renderer',
        entry: './src/renderer/index.tsx',
        output: {
            filename: 'renderer.bundle.js',
            path: path.resolve(__dirname, 'build')
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, './public/index.html'),
            })
        ]
    })
]
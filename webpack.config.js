module.exports = {
    watch: true,

    target: "electron-renderer",

    entry: "./app/src/index.js",

    output: {
        path: __dirname + "/app/build",
        publicPath: "build/",
        filename: "bundle.js",
    },

    module: {
        rules: [
            {
                test: /\.jsx?$/,
                loader: "babel-loader",
                options: {
                    presets: ["@babel/preset-react"]
                }
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/,
                loader: "file-loader",
                options: {
                    esModule: false,
                },
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ]
    }
}
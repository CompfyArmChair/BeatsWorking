'use strict';

const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {

    entry: {
        app: './src/index.js',
        'production-dependencies': ['phaser']
    },

    output: {
        path: path.resolve(__dirname, 'build'),
        publicPath: '/',
        filename: 'project.bundle.js'
    },

    module: {
        rules: [
          {
            test: [ /\.vert$/, /\.frag$/ ],
            use: 'raw-loader'
          },
          {
            test:  /\.js$/,
            include: path.resolve(__dirname, 'src/'),
            use: {
                loader: 'babel-loader',
                options: {
                  presets: ['env']
                }
              }
          },
          {
             test: /\.json$/, 
             include: path.resolve(__dirname, 'src/'),
             use: 'json-loader'
          }
        ]
    },

    plugins: [
        new webpack.DefinePlugin({
            'CANVAS_RENDERER': JSON.stringify(true),
            'WEBGL_RENDERER': JSON.stringify(true)
        }),        
        new CopyWebpackPlugin([
            {
                from: path.resolve(__dirname, 'index.html'),
                to: path.resolve(__dirname, 'build')
            },
            { from: 'Sound', to: 'Sound' },
            { from: 'assets', to: 'assets' }
        ]),
        new webpack.optimize.UglifyJsPlugin({
            drop_console: true,
            minimize: true,
            output: {
              comments: false
            }
        }),
        new webpack.optimize.CommonsChunkPlugin({
            name: 'production-dependencies',
            filename: 'production-dependencies.bundle.js'
          })
    ]
};
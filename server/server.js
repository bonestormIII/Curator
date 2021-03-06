var http = require('http');
var fs = require('fs');
var url = require('url');
var express = require('express');
var app = require('./app');
var util = require('./util');

// app configuration data
var rootPath = '../curator-client/dist';
var validFileTypes = /\.gif|\.jpg|\.jpeg/i;
var serverPort = 8080;

RegExp.prototype.toJSON = RegExp.prototype.toString;

// App initialization and server startup.
var appInstance = app({
    fileInfo: {
        validFileTypes: validFileTypes,
    }
});

// Server routing

// Static serve up the client folder which will handle all the html/js/css etc files
appInstance.expressInstance.use('/', express.static(rootPath));

// Handle client requests for a given file
appInstance.expressInstance.get('/api/file', function (req, res) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(util.getQueryValueString(reqURL.query));

    var filename = reqURL.query.filename;

    // Serve the current image
    if (!appInstance.isValidFile(filename)) {
        res.end();
    }
    else {
        util.serveFile(res, appInstance.getFilePath(filename));
    }
});

// Handle client requests to get file information for the current file
appInstance.expressInstance.get('/api/currentFileInfo', function (req, res) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(util.getQueryValueString(reqURL.query));

    // get the meta of the current file
    var meta = appInstance.getFileMetadata();
    console.log("Returning metadata " + JSON.stringify(meta));
    util.serveJavascriptObject(res, meta);
});

// Actions (client requests to do something..)
appInstance.expressInstance.get('/api/action', function (req, res, next) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(util.getQueryValueString(reqURL.query));

    // get the previous file from the set
    if (reqURL.query.button === 'prev') {
        appInstance.getPrevValidFile();
        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata());
            return;
        }
    }
    // get the next file from the set
    else if (reqURL.query.button === 'next') {
        appInstance.getNextValidFile();
        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata());
            return;
        }
    }
    // mark a file for backup
    else if (reqURL.query.button === 'keep') {
        var filename = reqURL.query.filename;
        appInstance.updateFileMetadata(filename, { keep: true });
        appInstance.moveToBackupFolder(filename);

        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata(filename));
            return;
        }
    }
    // unmark the file for backup
    else if (reqURL.query.button === 'unkeep') {
        var filename = reqURL.query.filename;
        appInstance.updateFileMetadata(filename, { keep: false });
        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata(filename));
            return;
        }
    }
    // move all the files marked for backup to the backup directory
    else if (reqURL.query.button === 'move') {
        appInstance.moveFilesToBackupFolder();
        if (reqURL.query.ajax === 'true') {
            return;
        }
    }
    // tag a picutre
    else if (reqURL.query.button === 'tag') {
        var filename = reqURL.query.filename;
        var tag = reqURL.query.tag;
        appInstance.addTag(filename, tag);
        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata(filename));
            return;
        }
    }
    // untag a picture
    else if (reqURL.query.button === 'untag') {
        var filename = reqURL.query.filename;
        var tag = reqURL.query.tag;
        appInstance.removeTag(filename, tag);
        if (reqURL.query.ajax === 'true') {
            util.serveJavascriptObject(res, appInstance.getFileMetadata(filename));
            return;
        }
    }

    // This will redirect back to the root path so that the form buttons will work
    res.redirect('/');
});

// Server start
appInstance.expressInstance.listen(8080, function () {
    console.log('Server running on port ' + serverPort);
})

// Server shutdown hooks
process.on('SIGINT', function () {
    console.log('Caught SIGINT');
    process.exit();
});

process.on('SIGTERM', function () {
    console.log('Caught SIGTERM');
    process.exit();
})

process.on('exit', function () {
    console.log("Exiting..");
    appInstance.saveAllFileInfosSync();
});

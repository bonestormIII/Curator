var http = require('http');
var fs = require('fs');
var url = require('url');
var express = require('express');

var app = express();
var hostname = '192.168.0.102';
var port = 8080;
var validFileTypes = /.gif|.jpg|.jpeg/i;

var contentTypes = {
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpg',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.js': 'text/javascript',
    '.css': "text/css",
}

var fileMetaData = function (init) {
    init = init || {};
    var that = {};
    that.filename = init.filename || '';
    that.path = init.path || '';
    that.keep = init.keep || false;
    that.tags = init.tags || [];
    return that;
}

var fileInfo = {
    dir: '',
    currFile: undefined,
    currFileIndex: -1,
    dirFiles: [],
    fileMetaData: {},
}

fileInfo.dir = 'C:\\Users\\lockhart\\OneDrive\\Photos\\2011\\2012-01-04';

var rootPath = '../client';
var defaultDoc = '/index.html';

// getFiles()
// 
// Retrieves a list of files and sets the next valid file
function getFiles(fileInfo) {
    fileInfo.dirFiles = fs.readdirSync(fileInfo.dir);
    
    // build meta data
    while (getNextFile(fileInfo)) {
        fileInfo.fileMetaData[fileInfo.currFile] = fileMetaData({
            filename: fileInfo.currFile,
            path: fileInfo.dir,
            keep: false
        })
    }
    
    // return to start
    while (getPrevFile(fileInfo));

    if (!isValidFile(fileInfo)) {
        getNextValidFile([getNextFile, getPrevFile], fileInfo);
    }
}

// getPrevFile(fileInfo)
//
// Gets the previous file for the given fileInfo object
// returns true if getPrevFile can be called again, false otherwise (i.e. is at the beginning of the file set)
function getPrevFile(fileInfo) {
    if (fileInfo && fileInfo.currFileIndex > 0) {
        fileInfo.currFileIndex -= 1;
        fileInfo.currFile = fileInfo.dirFiles[fileInfo.currFileIndex];
        return true;
    }

    return false;
}

// getNextFile(fileInfo)
//
// Gets the next file for the given fileInfo object
// returns true if getNextFile can be called again, false otherwise (i.e. is at the end of the file set)
function getNextFile(fileInfo) {
    if (fileInfo && fileInfo.currFileIndex < fileInfo.dirFiles.length - 1) {
        fileInfo.currFileIndex += 1;
        fileInfo.currFile = fileInfo.dirFiles[fileInfo.currFileIndex];
        return true;
    }

    return false;
}

// getQueryValueString(query, strNewline)
//
// Gets the values of the query string object as a single string
function getQueryValueString(query, strNewline) {
    strNewline = strNewline || '\n';
    var queryVals = '';
    for (var prop in query) {
        queryVals += prop + ':' + query[prop] + strNewline;
    }
    return queryVals;
}

// getContentType(path)
//
// Retrieves the content type using the extension of the file
// passed in the path parameter
function getContentType(path) {
    path = path || '';
    var i = path.lastIndexOf('.');
    if (i > -1) {
        return contentTypes[path.substr(i)];
    }
}

// serveFile(res, path, contentType)
//
// Serves a file to the response stream
// res : the http.ServerResponse object
// path : the path of the file to serve
function serveFile(res, path) {
    if (res && path) {
        fs.readFile(path, function (err, data) {
            if (err) {
                if (err.code === 'ENOENT') {
                    console.log(path + ' not found returning 404 response');
                    res.writeHead(404);
                    res.end();
                    return;
                }
                else {
                    throw err;
                }
            }
            else {
                console.log('Now serving ' + path);
                var contentType = getContentType(path);
                if (contentType) {
                    res.writeHead(200, { 'Content-Type': contentType });
                }

                res.end(data);
                return;
            }
        });
    }
}

// serveJavascriptObject(res, obj, callback)
//
// Serves a javascript object as the response.  Can optionally use jsonp to return the object by supplying a callback
// method name.
// res : the http.ServerResponse object
// obj : the javascript object to return in the response as a JSON string
// callback : an optional string containing the name of a callback function to wrap around the JSON object string
function serveJavascriptObject(res, obj, callback) {
    if (callback) {
        res.writeHead(200, { 'Content-type': 'application/javascript' });
        res.end(callback + '(' + JSON.stringify(obj) + ');');
    }
    else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
    }
}

// isValidFile(fileInfo)
//
// Determines if the next file is a valid file type
function isValidFile(fileInfo, filename) {
    filename = filename || fileInfo.currFile;
    return filename.match(validFileTypes) && fileInfo.fileMetaData[filename];
}

// getNextValidFile(funcArr, fileInfo, currMethod)
//
// Uses an array of functions to try and find the next valid file
//
// funcArr : an array of functions with signature (fileInfo) => bool 
// each function in the array will be called until either the function returns false
// or the function sets a valid file for fileInfo.
// 
// fileInfo : the fileInfo object
//
// currFunc : the index into funcArr which indicates the function being called
function getNextValidFile(funcArr, fileInfo, currFunc) {
    currFunc = currFunc || 0;

    if (currFunc < funcArr.length) {
        // use the current method until it returns false or a valid file
        // type is returned
        do {
            var res = funcArr[currFunc](fileInfo);
        }
        while (res && !isValidFile(fileInfo));

        if (!isValidFile(fileInfo)) {
            // call the next function to try and find a file
            getNextValidFile(funcArr, fileInfo, ++currFunc);
        }
    }
}

// createServer
// creates the server
app.use('/', express.static(rootPath));

app.get('/file', function (req, res) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(getQueryValueString(reqURL.query));

    var filename = reqURL.query.filename || fileInfo.currFile;
            
    // Serve the current image
    if (!isValidFile(fileInfo, filename)) {
        res.end();
    }
    else {
        serveFile(res, fileInfo.dir + '\\' + filename);
    }
});

app.get('/currentFileInfo', function (req, res) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(getQueryValueString(reqURL.query));

    serveJavascriptObject(res, fileInfo.fileMetaData[fileInfo.currFile]);
});

app.get('/action', function (req, res) {
    var reqURL = url.parse(req.url, true);
    console.log("Received query: " + req.url + '\n');
    console.log(getQueryValueString(reqURL.query));

    // Button actions
    if (reqURL.query.button === 'prev') {
        getNextValidFile([getPrevFile, getNextFile], fileInfo);
        if (reqURL.query.ajax === 'true') {
            serveJavascriptObject(res, fileInfo.fileMetaData[fileInfo.currFile]);
            return;
        }
    }
    else if (reqURL.query.button === 'next') {
        getNextValidFile([getNextFile, getPrevFile], fileInfo);
        if (reqURL.query.ajax === 'true') {
            serveJavascriptObject(res, fileInfo.fileMetaData[fileInfo.currFile]);
            return;
        }
    }
    else if (reqURL.query.button === 'keep') {
        var filename = reqURL.query.filename;
        fileInfo.fileMetaData[filename].keep = true;
        if (reqURL.query.ajax === 'true') {
            serveJavascriptObject(res, fileInfo.fileMetaData[filename]);
            return;
        }
    }
    else if (reqURL.query.button === 'unkeep') {
        var filename = reqURL.query.filename;
        fileInfo.fileMetaData[filename].keep = false;
        if (reqURL.query.ajax === 'true') {
            serveJavascriptObject(res, fileInfo.fileMetaData[filename]);
            return;
        }
    }
});


// Server startup
getFiles(fileInfo);

app.listen(8080, function () {
    console.log('Server running at ' + hostname + ' on port ' + port);
})
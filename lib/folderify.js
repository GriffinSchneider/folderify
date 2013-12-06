/*
 * folderify
 * https://github.com/parroit/folderify
 *
 * Copyright (c) 2013 parroit
 * Licensed under the MIT license.
 */



var brfs = require("brfs"),
    concat = require("concat-stream"),
    includeFolder = require("include-folder"),
    falafel = require('falafel'),
    through = require('through'),
    data,
    pending,
    ifNames,
    tr;



function isIF (node) {
    var c = node.callee;
    return c &&
        node.arguments[0].value === 'include-folder' &&
        node.type === 'CallExpression' &&
        c.type === 'Identifier' &&
        c.name === 'require'
        ;
}


function write (buf) {
    data += buf;
}

function end () {



    try {
        parse();
    }
    catch (err) {
        console.log("%s\n%s",err.message,err.stack);
        this.emit('error', err);
    }


}

function finish (output) {
    tr.queue(String(output));
    tr.queue(null);
}


function isVarDecl(node) {
    return isIF(node) &&
        node.parent.type === 'VariableDeclarator' &&
        node.parent.id.type === 'Identifier'

    ;
}
function isVarAssign(node) {
    return isIF(node) &&
        node.parent.type === 'AssignmentExpression' &&
        node.parent.left.type === 'Identifier'

    ;
}
function unrequireIF(node) {
    function unrequire(n){
        n.update("undefined");
    }
    if (isVarDecl(node)) {

        ifNames[node.parent.id.name] = true;

        unrequire(node.parent.init);
    } else if (isVarAssign(node)) {

        ifNames[node.parent.left.name] = true;

        unrequire(node.parent.right);
    }
}

function buildOriginalSource(folder) {
    var fnBody = includeFolder._testHook.buildSource(folder);
    return "(function(){" +
        fnBody +
        "})()";
}

function parse() {

    var output = falafel(data, function (node) {
        unrequireIF(node);

        if (node.type === 'CallExpression' && node.callee && ifNames[node.callee.name]) {
            var folder = node.arguments[0].value;
            if (folder.charAt(folder.length - 1) !== "/") {
                folder += "/";
            }
            var originalSource;

            originalSource = buildOriginalSource(folder);

            var brfsStream = brfs(folder+"bogus.txt");

            var brfsResult = concat(function (data) {
                //console.log("\n\npending:%s\n\n",pending);
                node.update(data);
                pending--;
                if (pending === 0) {
                    finish(output);
                }
            });

            brfsStream.on("error",function(err){
                //console.log(err);
                console.log("%s\n%s",err.message,err.stack);
                this.emit('error', err);
            });

            brfsStream.pipe(brfsResult);
            //console.log(originalSource);
            brfsStream.write(originalSource);
            brfsStream.end();

            pending++;
        }
    });

    if (pending === 0) {
        finish(output);
    }

}

function folderify() {
    data = '';
    pending = 0;
    ifNames = {};
    tr = through(write, end);

    return tr;

}


module.exports = folderify;
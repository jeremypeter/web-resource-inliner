"use strict";


var path = require( "path" );
var url = require( "url" );
var datauri = require( "datauri" );
var fs = require( "fs" );
var request = require( "request" );
var clc = require('cli-color');

var util = {};

module.exports = util;

util.defaults = {
    images: 8,
    scripts: true,
    links: true,
    uglify: false,
    cssmin: false,
    strict: false,
    relativeTo: '',
    rebaseRelativeTo: '',
    inlineAttribute: 'data-inline',
    fileContent: ''
};

/**
 * Escape special regex characters of a particular string
 * 
 * @example
 * "http://www.test.com" --> "http:\/\/www\.test\.com"
 *     
 * @param  {String} str - string to escape
 * @return {String} string with special characters escaped
 */
util.escapeSpecialChars = function(str)
{
    return str.replace(/(\/|\.|\$|\^|\{|\[|\(|\||\)|\*|\+|\?|\\)/g, '\\$1');
};

util.isRemotePath = function( url )
{
    return url.match( /^'?https?:\/\// ) || url.match( /^\/\// );
};

util.isBase64Path = function( url )
{
    return url.match( /^'?data.*base64/ );
};

util.getAttrs = function( tagMarkup, settings )
{
    var tag = tagMarkup.match( /^<[^\W>]*/ );
    if ( tag )
    {
        tag = tag[ 0 ];
        var attrs = tagMarkup
            .replace( /^<[^\s>]*/, "" )
            .replace( /\/?>/, "" )
            .replace( />?\s?<\/[^>]*>$/, "" )
            .replace( new RegExp( settings.inlineAttribute + "-ignore", "gi" ), "" )
            .replace( new RegExp( settings.inlineAttribute, "gi" ), "" );

        if ( tag === "<script" || tag === "<img" )
        {
            return attrs.replace( /(src|language|type)=["'][^"']*["']/gi, "" ).trim();
        }
        else if ( tag === "<link" )
        {
            return attrs.replace( /(href|rel)=["'][^"']*["']/g, "" ).trim();
        }
    }
};

util.getRemote = function( uri, callback, toDataUri )
{
    if( uri.match(/^\/\//) )
    {
        uri = "https:" + uri;
    }

    request(
        {
            uri: uri,
            encoding: toDataUri ? "binary" : ""
        },
        function( err, response, body )
        {
            if( err )
            {
                return callback( err );
            }
            else if ( response.statusCode !== 200 )
            {
                return callback( new Error( uri + " returned http " + response.code ) );
            }

            if( toDataUri )
            {
                var b64 = new Buffer( body.toString(), "binary" ).toString( "base64" );
                var datauriContent = "data:" + response.headers[ "content-type" ] + ";base64," + b64;
                return( callback( null, datauriContent ) );
            }
            else
            {
                return callback( null, body );
            }
        } );
};

util.getInlineFilePath = function( src, relativeTo )
{
    src = src.replace( /^\//, '' );
    return path.resolve( relativeTo, src ).replace( /\?.*$/, '' );
};

util.getInlineFileContents = function( src, relativeTo )
{
    return fs.readFileSync( util.getInlineFilePath( src, relativeTo ) );
};

util.getTextReplacement = function( src, relativeTo, callback )
{
    if( util.isRemotePath( relativeTo ) )
    {
        util.getRemote( url.resolve( relativeTo, src ), callback );
    }
    else if( util.isRemotePath( src ) )
    {
        util.getRemote( src, callback );
    }
    else
    {
        try
        {
            var replacement = util.getInlineFileContents( src, relativeTo );
            return callback( null,  replacement );
        }
        catch (err)
        {
            return callback( err );
        }
    }
};

util.getFileReplacement = function( src, relativeTo, callback )
{
    if( util.isRemotePath( src ) )
    {
        util.getRemote( src, callback, true );
    }
    else
    {
        var result = ( new datauri( util.getInlineFilePath( src, relativeTo ) ) ).content;
        callback( result === undefined ? new Error( "Local file not found" ) : null, result );
    }
};

util.handleReplaceErr = function ( err, src, strict, callback )
{
    if( strict )
    {
        return callback( err );
    }
    else
    {
        console.warn( clc.yellow( "Not found, skipping: " + src ) );
        return callback( null );
    }
};

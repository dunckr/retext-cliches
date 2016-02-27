/**
 * @author Duncan Beaton
 * @copyright 2016 Duncan Beaton
 * @license MIT
 * @module retext:cliches
 * @fileoverview Check phrases cliches.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var difference = require('array-differ');
var nlcstToString = require('nlcst-to-string');
var quotation = require('quotation');
var search = require('nlcst-search');
var list = require('no-cliches/lib/list');

/**
 * Attacher.
 *
 * @param {Retext} processor
 *   - Instance.
 * @param {Object?} [options]
 *   - Configuration.
 * @param {Array.<string>?} [options.ignore]
 *   - List of phrases to *not* warn about.
 * @return {Function} - `transformer`.
 */
function attacher(processor, options) {
    var ignore = (options || {}).ignore || [];
    var phrases = difference(list, ignore);

    /**
     * Search `tree` for validations.
     *
     * @param {Node} tree - NLCST node.
     * @param {VFile} file - Virtual file.
     */
    function transformer(tree, file) {
        search(tree, phrases, function (match, position, parent, phrase) {
            var value = quotation(nlcstToString(match), '“', '”');
            var message = 'Warning: ' + value  + ' is a cliche';

            message = file.warn(message, {
                'start': match[0].position.start,
                'end': match[match.length - 1].position.end
            });

            message.cliche = phrase;
            message.source = 'retext-cliche';
        });
    }

    return transformer;
}

/*
 * Expose.
 */

module.exports = attacher;

/**
 * @author Duncan Beaton
 * @copyright 2016 Duncan Beaton
 * @license MIT
 * @module retext:cliches
 * @fileoverview Check phrases cliches.
 */

'use strict';

/* eslint-env node */

/*
 * Dependencies.
 */

var test = require('tape');
var retext = require('retext');
var cliches = require('./');

/*
 * Tests.
 */

test('cliches', function (t) {
    t.plan(2);

    retext()
        .use(cliches)
        .process([
            'You can use cliches until the until the cows come home.',
            'Sorry to burst your bubble',
            'but you will sound like a broken record.'
        ].join('\n'), function (err, file) {
            t.ifError(err, 'should not fail (#1)');

            t.deepEqual(
                file.messages.map(String),
                [
                  '1:31-1:55: Warning: “until the cows come home” is a cliche',
                  '2:10-2:27: Warning: “burst your bubble” is a cliche',
                  '3:27-3:40: Warning: “broken record” is a cliche'
                ],
                'should warn about the use of cliches'
            );
        });

});


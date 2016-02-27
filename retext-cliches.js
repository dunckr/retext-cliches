(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.retextSimplify = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"array-differ":2,"nlcst-search":3,"nlcst-to-string":7,"no-cliches/lib/list":8,"quotation":9}],2:[function(require,module,exports){
'use strict';
module.exports = function (arr) {
	var rest = [].concat.apply([], [].slice.call(arguments, 1));
	return arr.filter(function (el) {
		return rest.indexOf(el) === -1;
	});
};

},{}],3:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module nlcst:search
 * @fileoverview Search for patterns in an NLCST tree.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var visit = require('unist-util-visit');
var normalize = require('nlcst-normalize');
var isLiteral = require('nlcst-is-literal');

/*
 * Methods.
 */

var has = Object.prototype.hasOwnProperty;

/*
 * Constants (characters).
 */

var C_SPACE = ' ';

/*
 * Constants (types).
 */

var T_WORD = 'WordNode';
var T_WHITE_SPACE = 'WhiteSpaceNode';

/**
 * Search.
 *
 * @param {Node} tree - NLCST node.
 * @param {Object|Array.<string>} phrases - Phrases to
 *   search for.  When `object`, searches for its keys.
 * @param {Function} handler - Handler.
 * @param {boolean} allowApostrophes - Do not strip
 *   apostrophes, normalize them.
 */
function search(tree, phrases, handler, allowApostrophes) {
    var apos = allowApostrophes;
    var byWord = {};
    var length;
    var index;
    var key;
    var firstWord;

    /**
     * Handle a phrase.
     *
     * @param {string} phrase - Phrase to search for.
     */
    function handlePhrase(phrase) {
        firstWord = normalize(phrase.split(C_SPACE, 1)[0], apos);

        if (has.call(byWord, firstWord)) {
            byWord[firstWord].push(phrase);
        } else {
            byWord[firstWord] = [phrase];
        }
    }

    if (!tree || !tree.type) {
        throw new Error('Expected node');
    }

    if (typeof phrases !== 'object') {
        throw new Error('Expected object for phrases');
    }

    length = phrases.length;
    index = -1;

    if ('length' in phrases) {
        while (++index < length) {
            handlePhrase(phrases[index]);
        }
    } else {
        for (key in phrases) {
            handlePhrase(key);
        }
    }

    /**
     * Test a phrase.
     *
     * @param {string} phrase - Phrase to search for.
     * @param {number} position - Position at which the
     *   first word of `phrase` exists.
     * @param {Node} parent - Parent of `node`.
     */
    function test(phrase, position, parent) {
        var siblings = parent.children;
        var node = siblings[position];
        var count = siblings.length;
        var queue = [node];
        var expression = phrase.split(C_SPACE).slice(1);
        var length = expression.length;
        var index = -1;

        /*
         * Move one position forward.
         */

        position++;

        /*
         * Iterate over `expression`.
         */

        while (++index < length) {
            /*
             * Allow joining white-space.
             */

            while (position < count) {
                node = siblings[position];

                if (node.type !== T_WHITE_SPACE) {
                    break;
                }

                queue.push(node);
                position++;
            }

            node = siblings[position];

            /*
             * Exit if there are no nodes left, if the
             * current node is not a word, or if the
             * current word does not match the search for
             * value.
             */

            if (
                !node ||
                node.type !== T_WORD ||
                normalize(expression[index], apos) !== normalize(node, apos)
            ) {
                return null;
            }

            queue.push(node);
            position++;
        }

        return queue;
    }

    /**
     * Visitor for `WordNode`s.
     *
     * @param {Node} node - Word.
     * @param {number} position - Position of `node` in
     *   `parent`.
     * @param {Node} parent - Parent of `node`.
     */
    function visitor(node, position, parent) {
        var word;
        var phrases;
        var length;
        var index;
        var result;

        if (isLiteral(parent, position)) {
            return;
        }

        word = normalize(node, apos);
        phrases = has.call(byWord, word) ? byWord[word] : [];
        length = phrases.length;
        index = -1;

        while (++index < length) {
            result = test(phrases[index], position, parent);

            if (result) {
                handler(result, position, parent, phrases[index]);
            }
        }
    }

    /*
     * Search the tree.
     */

    visit(tree, T_WORD, visitor);
}

/*
 * Expose.
 */

module.exports = search;

},{"nlcst-is-literal":4,"nlcst-normalize":5,"unist-util-visit":6}],4:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module nlcst:is-literal
 * @fileoverview Check whether an NLCST node is meant literally.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var toString = require('nlcst-to-string');

/*
 * Single delimiters.
 */

var single = {
    '-': true, // hyphen-minus
    '–': true, // en-dash
    '—': true, // em-dash
    ':': true, // colon
    ';': true // semicolon
};

/*
 * Pair delimiters. From common sense, and wikipedia:
 * Mostly from https://en.wikipedia.org/wiki/Quotation_mark.
 */

var pairs = {
    ',': {
        ',': true
    },
    '-': {
        '-': true
    },
    '–': {
        '–': true
    },
    '—': {
        '—': true
    },
    '"': {
        '"': true
    },
    '\'': {
        '\'': true
    },
    '‘': {
        '’': true
    },
    '‚': {
        '’': true
    },
    '’': {
        '’': true,
        '‚': true
    },
    '“': {
        '”': true
    },
    '”': {
        '”': true
    },
    '„': {
        '”': true,
        '“': true
    },
    '«': {
        '»': true
    },
    '»': {
        '«': true
    },
    '‹': {
        '›': true
    },
    '›': {
        '‹': true
    },
    '(': {
        ')': true
    },
    '[': {
        ']': true
    },
    '{': {
        '}': true
    },
    '⟨': {
        '⟩': true
    },
    '「': {
        '」': true
    }
}

/**
 * Check whether parent contains word-nodes between
 * `start` and `end`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} start - Starting point (inclusive).
 * @param {number} end - Ending point (exclusive).
 * @return {boolean} - Whether word-nodes are found.
 */
function containsWord(parent, start, end) {
    var siblings = parent.children;
    var index = start - 1;

    while (++index < end) {
        if (siblings[index].type === 'WordNode') {
            return true;
        }
    }

    return false;
}

/**
 * Check if there are word nodes before `position`
 * in `parent`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} position - Position before which to
 *   check.
 * @return {boolean} - Whether word-nodes are found.
 */
function hasWordsBefore(parent, position) {
    return containsWord(parent, 0, position);
}

/**
 * Check if there are word nodes before `position`
 * in `parent`.
 *
 * @param {NLCSTParentNode} parent - Node with children.
 * @param {number} position - Position afyer which to
 *   check.
 * @return {boolean} - Whether word-nodes are found.
 */
function hasWordsAfter(parent, position) {
    return containsWord(parent, position + 1, parent.children.length);
}

/**
 * Check if `node` is in `delimiters`.
 *
 * @param {Node} node - Node to check.
 * @param {Object} delimiters - Map of delimiters.
 * @return {(Node|boolean)?} - `false` if not, the given
 *   node when true, and `null` when this is a white-space
 *   node.
 */
function delimiterCheck(node, delimiters) {
    var type = node.type;

    if (type === 'WordNode' || type === 'SourceNode') {
        return false;
    }

    if (type === 'WhiteSpaceNode') {
        return null;
    }

    return toString(node) in delimiters ? node : false;
}

/**
 * Find the next delimiter after `position` in
 * `parent`. Returns the delimiter node when found.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position to search after.
 * @param {Object} delimiters - Map of delimiters.
 * @return {Node?} - Following delimiter.
 */
function nextDelimiter(parent, position, delimiters) {
    var siblings = parent.children;
    var index = position;
    var length = siblings.length;
    var result;

    while (++index < length) {
        result = delimiterCheck(siblings[index], delimiters);

        if (result === null) {
            continue;
        }

        return result;
    }

    return null;
}

/**
 * Find the previous delimiter before `position` in
 * `parent`. Returns the delimiter node when found.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position to search before.
 * @param {Object} delimiters - Map of delimiters.
 * @return {Node?} - Previous delimiter.
 */
function previousDelimiter(parent, position, delimiters) {
    var siblings = parent.children;
    var index = position;
    var result;

    while (index--) {
        result = delimiterCheck(siblings[index], delimiters);

        if (result === null) {
            continue;
        }

        return result;
    }

    return null;
}

/**
 * Check if the node in `parent` at `position` is enclosed
 * by matching delimiters.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} position - Position of node to check.
 * @param {Object} delimiters - Map of delimiters.
 * @return {boolean} - Whether the node is wrapped.
 */
function isWrapped(parent, position, delimiters) {
    var prev = previousDelimiter(parent, position, delimiters);
    var next;

    if (prev) {
        next = nextDelimiter(parent, position, delimiters[toString(prev)]);
    }

    return Boolean(next);
}

/**
 * Check if the node in `parent` at `position` is enclosed
 * by matching delimiters.
 *
 * For example, in:
 *
 * -   `Foo - is meant as a literal.`;
 * -   `Meant as a literal is - foo.`;
 * -   `The word “foo” is meant as a literal.`;
 *
 * ...`foo` is literal.
 *
 * @param {NLCSTParentNode} parent - Parent to search.
 * @param {number} index - Position of node to check.
 * @return {boolean} - Whether the node is wrapped.
 */
function isLiteral(parent, index) {
    if (!(parent && parent.children)) {
        throw new Error('Parent must be a node');
    }

    if (isNaN(index)) {
        throw new Error('Index must be a number');
    }

    if (
        (!hasWordsBefore(parent, index) && nextDelimiter(parent, index, single)) ||
        (!hasWordsAfter(parent, index) && previousDelimiter(parent, index, single)) ||
        isWrapped(parent, index, pairs)
    ) {
        return true;
    }

    return false;
}

/*
 * Expose.
 */

module.exports = isLiteral;

},{"nlcst-to-string":7}],5:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module nlcst:normalize
 * @fileoverview Normalize a word for easier comparison.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Dependencies.
 */

var toString = require('nlcst-to-string');

/*
 * Constants.
 */

var ALL = /[-'’]/g;
var DASH = /-/g;
var APOSTROPHE = /’/g;
var QUOTE = '\'';
var EMPTY = '';

/**
 * Normalize `value`.
 *
 * @param {string} value - Value to normalize.
 * @param {boolean} allowApostrophes - Do not strip
 *   apostrophes.
 * @return {string} - Normalized `value`.
 */
function normalize(value, allowApostrophes) {
    var result = (typeof value === 'string' ? value : toString(value))
        .toLowerCase();

    if (allowApostrophes) {
        return result
            .replace(APOSTROPHE, QUOTE)
            .replace(DASH, EMPTY);
    }

    return result.replace(ALL, EMPTY);
}

/*
 * Expose.
 */

module.exports = normalize;

},{"nlcst-to-string":7}],6:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2015 Titus Wormer. All rights reserved.
 * @module unist:util:visit
 * @fileoverview Utility to recursively walk over unist nodes.
 */

'use strict';

/**
 * Walk forwards.
 *
 * @param {Array.<*>} values - Things to iterate over,
 *   forwards.
 * @param {function(*, number): boolean} callback - Function
 *   to invoke.
 * @return {boolean} - False if iteration stopped.
 */
function forwards(values, callback) {
    var index = -1;
    var length = values.length;

    while (++index < length) {
        if (callback(values[index], index) === false) {
            return false;
        }
    }

    return true;
}

/**
 * Walk backwards.
 *
 * @param {Array.<*>} values - Things to iterate over,
 *   backwards.
 * @param {function(*, number): boolean} callback - Function
 *   to invoke.
 * @return {boolean} - False if iteration stopped.
 */
function backwards(values, callback) {
    var index = values.length;
    var length = -1;

    while (--index > length) {
        if (callback(values[index], index) === false) {
            return false;
        }
    }

    return true;
}

/**
 * Visit.
 *
 * @param {Node} tree - Root node
 * @param {string} [type] - Node type.
 * @param {function(node): boolean?} callback - Invoked
 *   with each found node.  Can return `false` to stop.
 * @param {boolean} [reverse] - By default, `visit` will
 *   walk forwards, when `reverse` is `true`, `visit`
 *   walks backwards.
 */
function visit(tree, type, callback, reverse) {
    var iterate;
    var one;
    var all;

    if (typeof type === 'function') {
        reverse = callback;
        callback = type;
        type = null;
    }

    iterate = reverse ? backwards : forwards;

    /**
     * Visit `children` in `parent`.
     */
    all = function (children, parent) {
        return iterate(children, function (child, index) {
            return child && one(child, index, parent);
        });
    };

    /**
     * Visit a single node.
     */
    one = function (node, index, parent) {
        var result;

        index = index || (parent ? 0 : null);

        if (!type || node.type === type) {
            result = callback(node, index, parent || null);
        }

        if (node.children && result !== false) {
            return all(node.children, node);
        }

        return result;
    };

    one(tree);
}

/*
 * Expose.
 */

module.exports = visit;

},{}],7:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2014-2015 Titus Wormer
 * @license MIT
 * @module nlcst:to-string
 * @fileoverview Transform an NLCST node into a string.
 */

'use strict';

/* eslint-env commonjs */

/**
 * Stringify an NLCST node.
 *
 * @param {NLCSTNode|Array.<NLCSTNode>} node - Node to to
 *   stringify.
 * @param {string} separator - Value to separate each item
 *   with.
 * @return {string} - Stringified `node`.
 */
function nlcstToString(node, separator) {
    var values;
    var length;
    var children;

    separator = separator || '';

    if (typeof node.value === 'string') {
        return node.value;
    }

    children = 'length' in node ? node : node.children;
    length = children.length;

    /*
     * Shortcut: This is pretty common, and a small performance win.
     */

    if (length === 1 && 'value' in children[0]) {
        return children[0].value;
    }

    values = [];

    while (length--) {
        values[length] = nlcstToString(children[length], separator);
    }

    return values.join(separator);
}

/*
 * Expose.
 */

module.exports = nlcstToString;

},{}],8:[function(require,module,exports){
module.exports = [
  'a chip off the old block',
  'a clean slate',
  'a dark and stormy night',
  'a far cry',
  'a fine kettle of fish',
  'a loose cannon',
  'a penny saved is a penny earned',
  'a tough row to hoe',
  'a word to the wise',
  'ace in the hole',
  'acid test',
  'add insult to injury',
  'against all odds',
  'air your dirty laundry',
  'all fun and games',
  'all in a day\'s work',
  'all talk, no action',
  'all thumbs',
  'all your eggs in one basket',
  'all\'s fair in love and war',
  'all\'s well that ends well',
  'almighty dollar',
  'American as apple pie',
  'an axe to grind',
  'another day, another dollar',
  'armed to the teeth',
  'as luck would have it',
  'as old as time',
  'as the crow flies',
  'at loose ends',
  'at my wits end',
  'avoid like the plague',
  'babe in the woods',
  'back against the wall',
  'back in the saddle',
  'back to square one',
  'back to the drawing board',
  'bad to the bone',
  'badge of honor',
  'bald faced liar',
  'ballpark figure',
  'banging your head against a brick wall',
  'baptism by fire',
  'barking up the wrong tree',
  'bat out of hell',
  'be all and end all',
  'beat a dead horse',
  'beat around the bush',
  'been there, done that',
  'beggars can\'t be choosers',
  'behind the eight ball',
  'bend over backwards',
  'benefit of the doubt',
  'bent out of shape',
  'best thing since sliced bread',
  'bet your bottom dollar',
  'better half',
  'better late than never',
  'better mousetrap',
  'better safe than sorry',
  'between a rock and a hard place',
  'beyond the pale',
  'bide your time',
  'big as life',
  'big cheese',
  'big fish in a small pond',
  'big man on campus',
  'bigger they are the harder they fall',
  'bird in the hand',
  'bird\'s eye view',
  'birds and the bees',
  'birds of a feather flock together',
  'bit the hand that feeds you',
  'bite the bullet',
  'bite the dust',
  'bitten off more than he can chew',
  'black as coal',
  'black as pitch',
  'black as the ace of spades',
  'blast from the past',
  'bleeding heart',
  'blessing in disguise',
  'blind ambition',
  'blind as a bat',
  'blind leading the blind',
  'blood is thicker than water',
  'blood sweat and tears',
  'blow off steam',
  'blow your own horn',
  'blushing bride',
  'boils down to',
  'bolt from the blue',
  'bone to pick',
  'bored stiff',
  'bored to tears',
  'bottomless pit',
  'boys will be boys',
  'bright and early',
  'brings home the bacon',
  'broad across the beam',
  'broken record',
  'brought back to reality',
  'bull by the horns',
  'bull in a china shop',
  'burn the midnight oil',
  'burning question',
  'burning the candle at both ends',
  'burst your bubble',
  'bury the hatchet',
  'busy as a bee',
  'by hook or by crook',
  'call a spade a spade',
  'called onto the carpet',
  'calm before the storm',
  'can of worms',
  'can\'t cut the mustard',
  'can\'t hold a candle to',
  'case of mistaken identity',
  'cat got your tongue',
  'cat\'s meow',
  'caught in the crossfire',
  'caught red-handed',
  'checkered past',
  'chomping at the bit',
  'cleanliness is next to godliness',
  'clear as a bell',
  'clear as mud',
  'close to the vest',
  'cock and bull story',
  'cold shoulder',
  'come hell or high water',
  'cool as a cucumber',
  'cool, calm, and collected',
  'cost a king\'s ransom',
  'count your blessings',
  'crack of dawn',
  'crash course',
  'creature comforts',
  'cross that bridge when you come to it',
  'crushing blow',
  'cry like a baby',
  'cry me a river',
  'cry over spilt milk',
  'crystal clear',
  'curiosity killed the cat',
  'cut and dried',
  'cut through the red tape',
  'cut to the chase',
  'cute as a bugs ear',
  'cute as a button',
  'cute as a puppy',
  'cuts to the quick',
  'dark before the dawn',
  'day in, day out',
  'dead as a doornail',
  'devil is in the details',
  'dime a dozen',
  'divide and conquer',
  'dog and pony show',
  'dog days',
  'dog eat dog',
  'dog tired',
  'don\'t burn your bridges',
  'don\'t count your chickens',
  'don\'t look a gift horse in the mouth',
  'don\'t rock the boat',
  'don\'t step on anyone\'s toes',
  'don\'t take any wooden nickels',
  'down and out',
  'down at the heels',
  'down in the dumps',
  'down the hatch',
  'down to earth',
  'draw the line',
  'dressed to kill',
  'dressed to the nines',
  'drives me up the wall',
  'dull as dishwater',
  'dyed in the wool',
  'eagle eye',
  'ear to the ground',
  'early bird catches the worm',
  'easier said than done',
  'easy as pie',
  'eat your heart out',
  'eat your words',
  'eleventh hour',
  'even the playing field',
  'every dog has its day',
  'every fiber of my being',
  'everything but the kitchen sink',
  'eye for an eye',
  'face the music',
  'facts of life',
  'fair weather friend',
  'fall by the wayside',
  'fan the flames',
  'feast or famine',
  'feather your nest',
  'feathered friends',
  'few and far between',
  'fifteen minutes of fame',
  'filthy vermin',
  'fine kettle of fish',
  'fish out of water',
  'fishing for a compliment',
  'fit as a fiddle',
  'fit the bill',
  'fit to be tied',
  'flash in the pan',
  'flat as a pancake',
  'flip your lid',
  'flog a dead horse',
  'fly by night',
  'fly the coop',
  'follow your heart',
  'for all intents and purposes',
  'for the birds',
  'for what it\'s worth',
  'force of nature',
  'force to be reckoned with',
  'forgive and forget',
  'fox in the henhouse',
  'free and easy',
  'free as a bird',
  'fresh as a daisy',
  'full steam ahead',
  'fun in the sun',
  'garbage in, garbage out',
  'gentle as a lamb',
  'get a kick out of',
  'get a leg up',
  'get down and dirty',
  'get the lead out',
  'get to the bottom of',
  'get your feet wet',
  'gets my goat',
  'gilding the lily',
  'give and take',
  'go against the grain',
  'go at it tooth and nail',
  'go for broke',
  'go him one better',
  'go the extra mile',
  'go with the flow',
  'goes without saying',
  'good as gold',
  'good deed for the day',
  'good things come to those who wait',
  'good time was had by all',
  'good times were had by all',
  'greased lightning',
  'greek to me',
  'green thumb',
  'green-eyed monster',
  'grist for the mill',
  'growing like a weed',
  'hair of the dog',
  'hand to mouth',
  'happy as a clam',
  'happy as a lark',
  'hasn\'t a clue',
  'have a nice day',
  'have high hopes',
  'have the last laugh',
  'haven\'t got a row to hoe',
  'head honcho',
  'head over heels',
  'hear a pin drop',
  'heard it through the grapevine',
  'heart\'s content',
  'heavy as lead',
  'hem and haw',
  'high and dry',
  'high and mighty',
  'high as a kite',
  'hit paydirt',
  'hold your head up high',
  'hold your horses',
  'hold your own',
  'hold your tongue',
  'honest as the day is long',
  'horns of a dilemma',
  'horse of a different color',
  'hot under the collar',
  'hour of need',
  'I beg to differ',
  'icing on the cake',
  'if the shoe fits',
  'if the shoe were on the other foot',
  'in a jam',
  'in a jiffy',
  'in a nutshell',
  'in a pig\'s eye',
  'in a pinch',
  'in a word',
  'in hot water',
  'in the gutter',
  'in the nick of time',
  'in the thick of it',
  'in your dreams',
  'it ain\'t over till the fat lady sings',
  'it goes without saying',
  'it takes all kinds',
  'it takes one to know one',
  'it\'s a small world',
  'it\'s only a matter of time',
  'ivory tower',
  'Jack of all trades',
  'jockey for position',
  'jog your memory',
  'joined at the hip',
  'judge a book by its cover',
  'jump down your throat',
  'jump in with both feet',
  'jump on the bandwagon',
  'jump the gun',
  'jump to conclusions',
  'just a hop, skip, and a jump',
  'just the ticket',
  'justice is blind',
  'keep a stiff upper lip',
  'keep an eye on',
  'keep it simple, stupid',
  'keep the home fires burning',
  'keep up with the Joneses',
  'keep your chin up',
  'keep your fingers crossed',
  'kick the bucket',
  'kick up your heels',
  'kick your feet up',
  'kid in a candy store',
  'kill two birds with one stone',
  'kiss of death',
  'knock it out of the park',
  'knock on wood',
  'knock your socks off',
  'know him from Adam',
  'know the ropes',
  'know the score',
  'knuckle down',
  'knuckle sandwich',
  'knuckle under',
  'labor of love',
  'ladder of success',
  'land on your feet',
  'lap of luxury',
  'last but not least',
  'last hurrah',
  'last-ditch effort',
  'law of the jungle',
  'law of the land',
  'lay down the law',
  'leaps and bounds',
  'let sleeping dogs lie',
  'let the cat out of the bag',
  'let the good times roll',
  'let your hair down',
  'let\'s talk turkey',
  'letter perfect',
  'lick your wounds',
  'lies like a rug',
  'life\'s a bitch',
  'life\'s a grind',
  'light at the end of the tunnel',
  'lighter than a feather',
  'lighter than air',
  'like clockwork',
  'like father like son',
  'like taking candy from a baby',
  'like there\'s no tomorrow',
  'lion\'s share',
  'live and learn',
  'live and let live',
  'long and short of it',
  'long lost love',
  'look before you leap',
  'look down your nose',
  'look what the cat dragged in',
  'looking a gift horse in the mouth',
  'looks like death warmed over',
  'loose cannon',
  'lose your head',
  'lose your temper',
  'loud as a horn',
  'lounge lizard',
  'loved and lost',
  'low man on the totem pole',
  'luck of the draw',
  'luck of the Irish',
  'make hay while the sun shines',
  'make money hand over fist',
  'make my day',
  'make the best of a bad situation',
  'make the best of it',
  'make your blood boil',
  'man of few words',
  'man\'s best friend',
  'mark my words',
  'meaningful dialogue',
  'missed the boat on that one',
  'moment in the sun',
  'moment of glory',
  'moment of truth',
  'money to burn',
  'more power to you',
  'more than one way to skin a cat',
  'movers and shakers',
  'moving experience',
  'naked as a jaybird',
  'naked truth',
  'neat as a pin',
  'needle in a haystack',
  'needless to say',
  'neither here nor there',
  'never look back',
  'never say never',
  'nip and tuck',
  'nip it in the bud',
  'no guts, no glory',
  'no love lost',
  'no pain, no gain',
  'no skin off my back',
  'no stone unturned',
  'no time like the present',
  'no use crying over spilled milk',
  'nose to the grindstone',
  'not a hope in hell',
  'not a minute\'s peace',
  'not in my backyard',
  'not playing with a full deck',
  'not the end of the world',
  'not written in stone',
  'nothing to sneeze at',
  'nothing ventured nothing gained',
  'now we\'re cooking',
  'off the top of my head',
  'off the wagon',
  'off the wall',
  'old hat',
  'older and wiser',
  'older than dirt',
  'older than Methuselah',
  'on a roll',
  'on cloud nine',
  'on pins and needles',
  'on the bandwagon',
  'on the money',
  'on the nose',
  'on the rocks',
  'on the spot',
  'on the tip of my tongue',
  'on the wagon',
  'on thin ice',
  'once bitten, twice shy',
  'one bad apple doesn\'t spoil the bushel',
  'one born every minute',
  'one brick short',
  'one foot in the grave',
  'one in a million',
  'one red cent',
  'only game in town',
  'open a can of worms',
  'open and shut case',
  'open the flood gates',
  'opportunity doesn\'t knock twice',
  'out of pocket',
  'out of sight, out of mind',
  'out of the frying pan into the fire',
  'out of the woods',
  'out on a limb',
  'over a barrel',
  'over the hump',
  'pain and suffering',
  'pain in the',
  'panic button',
  'par for the course',
  'part and parcel',
  'party pooper',
  'pass the buck',
  'patience is a virtue',
  'pay through the nose',
  'penny pincher',
  'perfect storm',
  'pig in a poke',
  'pile it on',
  'pillar of the community',
  'pin your hopes on',
  'pitter patter of little feet',
  'plain as day',
  'plain as the nose on your face',
  'play by the rules',
  'play your cards right',
  'playing the field',
  'playing with fire',
  'pleased as punch',
  'plenty of fish in the sea',
  'point with pride',
  'poor as a church mouse',
  'pot calling the kettle black',
  'pretty as a picture',
  'pull a fast one',
  'pull your punches',
  'pulling your leg',
  'pure as the driven snow',
  'put it in a nutshell',
  'put one over on you',
  'put the cart before the horse',
  'put the pedal to the metal',
  'put your best foot forward',
  'put your foot down',
  'quick as a bunny',
  'quick as a lick',
  'quick as a wink',
  'quick as lightning',
  'quiet as a dormouse',
  'rags to riches',
  'raining buckets',
  'raining cats and dogs',
  'rank and file',
  'rat race',
  'reap what you sow',
  'red as a beet',
  'red herring',
  'reinvent the wheel',
  'rich and famous',
  'rings a bell',
  'ripe old age',
  'ripped me off',
  'rise and shine',
  'road to hell is paved with good intentions',
  'rob Peter to pay Paul',
  'roll over in the grave',
  'rub the wrong way',
  'ruled the roost',
  'running in circles',
  'sad but true',
  'sadder but wiser',
  'salt of the earth',
  'scared stiff',
  'scared to death',
  'sealed with a kiss',
  'second to none',
  'see eye to eye',
  'seen the light',
  'seize the day',
  'set the record straight',
  'set the world on fire',
  'set your teeth on edge',
  'sharp as a tack',
  'shoot for the moon',
  'shoot the breeze',
  'shot in the dark',
  'shoulder to the wheel',
  'sick as a dog',
  'sigh of relief',
  'signed, sealed, and delivered',
  'sink or swim',
  'six of one, half a dozen of another',
  'skating on thin ice',
  'slept like a log',
  'slinging mud',
  'slippery as an eel',
  'slow as molasses',
  'smart as a whip',
  'smooth as a baby\'s bottom',
  'sneaking suspicion',
  'snug as a bug in a rug',
  'sow wild oats',
  'spare the rod, spoil the child',
  'speak of the devil',
  'spilled the beans',
  'spinning your wheels',
  'spitting image of',
  'spoke with relish',
  'spread like wildfire',
  'spring to life',
  'squeaky wheel gets the grease',
  'stands out like a sore thumb',
  'start from scratch',
  'stick in the mud',
  'still waters run deep',
  'stitch in time',
  'stop and smell the roses',
  'straight as an arrow',
  'straw that broke the camel\'s back',
  'strong as an ox',
  'stubborn as a mule',
  'stuff that dreams are made of',
  'stuffed shirt',
  'sweating blood',
  'sweating bullets',
  'take a load off',
  'take one for the team',
  'take the bait',
  'take the bull by the horns',
  'take the plunge',
  'takes one to know one',
  'takes two to tango',
  'the more the merrier',
  'the real deal',
  'the real McCoy',
  'the red carpet treatment',
  'the same old story',
  'there is no accounting for taste',
  'thick as a brick',
  'thick as thieves',
  'thin as a rail',
  'think outside of the box',
  'third time\'s the charm',
  'this day and age',
  'this hurts me worse than it hurts you',
  'this point in time',
  'three sheets to the wind',
  'through thick and thin',
  'throw in the towel',
  'tie one on',
  'tighter than a drum',
  'time and time again',
  'time is of the essence',
  'tip of the iceberg',
  'tired but happy',
  'to coin a phrase',
  'to each his own',
  'to make a long story short',
  'to the best of my knowledge',
  'toe the line',
  'tongue in cheek',
  'too good to be true',
  'too hot to handle',
  'too numerous to mention',
  'touch with a ten foot pole',
  'tough as nails',
  'trial and error',
  'trials and tribulations',
  'tried and true',
  'trip down memory lane',
  'twist of fate',
  'two cents worth',
  'two peas in a pod',
  'ugly as sin',
  'under the counter',
  'under the gun',
  'under the same roof',
  'under the weather',
  'until the cows come home',
  'unvarnished truth',
  'up the creek',
  'uphill battle',
  'upper crust',
  'upset the applecart',
  'vain attempt',
  'vain effort',
  'vanquish the enemy',
  'vested interest',
  'waiting for the other shoe to drop',
  'wakeup call',
  'warm welcome',
  'watch your p\'s and q\'s',
  'watch your tongue',
  'watching the clock',
  'water under the bridge',
  'weather the storm',
  'weed them out',
  'week of Sundays',
  'went belly up',
  'wet behind the ears',
  'what goes around comes around',
  'what you see is what you get',
  'when it rains, it pours',
  'when push comes to shove',
  'when the cat\'s away',
  'when the going gets tough, the tough get going',
  'white as a sheet',
  'whole ball of wax',
  'whole hog',
  'whole nine yards',
  'wild goose chase',
  'will wonders never cease?',
  'wisdom of the ages',
  'wise as an owl',
  'wolf at the door',
  'words fail me',
  'work like a dog',
  'world weary',
  'worst nightmare',
  'worth its weight in gold',
  'wrong side of the bed',
  'yanking your chain',
  'yappy as a dog',
  'years young',
  'you are what you eat',
  'you can run but you can\'t hide',
  'you only live once',
  'you\'re the boss ',
  'young and foolish',
  'young and vibrant',
];

},{}],9:[function(require,module,exports){
/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module quotation
 * @fileoverview Quote a value.
 */

'use strict';

/* eslint-env commonjs */

/*
 * Constants.
 */

var C_DEFAULT = '"';

/**
 * Quote text.
 *
 * @example
 *   quotation('one');
 *   // '"one"'
 *
 * @example
 *   quotation(['one', 'two']);
 *   // ['"one"', '"two"']
 *
 * @example
 *   quotation('one', '\'');
 *   // '\'one\''
 *
 * @example
 *   quotation('one', '“', '”');
 *   // '“one”'
 *
 * @param {string|Array.<string>} value - One or more
 *   values to quote.
 * @param {string} [open='"'] - Opening quote.
 * @param {string} [close] - Closing quote, defaults to
 *   `open` or the default (`"`) when not given.
 * @return {string} - Quoted `value`.
 * @throws {Error} - When not given `string` or
 *   `Array.<string>`.
 */
function quotation(value, open, close) {
    var result;
    var index;
    var length;

    open = open || C_DEFAULT;
    close = close || open;

    if (typeof value === 'string') {
        return open + value + close;
    }

    if (typeof value !== 'object' || !('length' in value)) {
        throw new Error('Expected string or array of strings');
    }

    result = [];
    length = value.length;
    index = -1;

    while (++index < length) {
        result[index] = quotation(value[index], open, close);
    }

    return result;
}

/*
 * Expose.
 */

module.exports = quotation;

},{}]},{},[1])(1)
});
# retext-cliches [![Build Status][travis-badge]][travis]

Check phrases for cliches with [**retext**][retext].

## Installation

[npm][npm-install]:

```bash
npm install retext-cliches
```

**retext-cliches** is also available for [duo][duo-install], and as an
AMD, CommonJS, and globals module, [uncompressed and compressed][releases].

## Usage

```js
var retext = require('retext');
var cliches = require('retext-cliches');
var report = require('vfile-reporter');

retext()
    .use(cliches)
    .process([
      'You can use cliches until the until the cows come home.',
      'Sorry to burst your bubble',
      'but you will sound like a broken record.',
    ].join('\n'), function (err, file) {
        console.log(report(file));
    });
```

Yields:

```txt
<stdin>
  1:31-1:55: Warning: “until the cows come home” is a cliche
  2:10-2:27: Warning: “burst your bubble” is a cliche
  3:27-3:40: Warning: “broken record” is a cliche

⚠ 3 warnings
```

## API

### `retext.use(cliches[, options])`

Check phrases for cliches.

**Parameters**

*   `cliches` — This plug-in;

*   `options` (`Object?`, optional):

    *   `ignore` (`Array.<string>`)
        — List of phrases to _not_ warn about.

## License

[MIT][license] © [Duncan Beaton][author]

<!-- Definitions -->

[travis-badge]: https://img.shields.io/travis/dunckr/retext-cliches.svg

[travis]: https://travis-ci.org/dunckr/retext-cliches

[npm-install]: https://docs.npmjs.com/cli/install

[duo-install]: http://duojs.org/#getting-started

[releases]: https://github.com/dunckr/retext-cliches/releases

[license]: LICENSE

[author]: http://dunckr.com

[retext]: https://github.com/dunckr/retext

# coc-phpls

PHP language server extension for [coc.nvim](https://github.com/neoclide/coc.nvim).

## Install

In your vim/neovim, run command:

```
:CocInstall coc-phpls
```

## Features

Language server features provided by [intelephense-docs](https://github.com/bmewburn/intelephense-docs).

## Configuration options

* `phpls.enable` set to `false` to disable php language server.

## Development

* Run yarn build or yarn build:watch
* Link extension

```bash
cd ~/github/coc-phpls       && yarn link
cd ~/.config/coc/extensions && yarn link coc-phpls
```

* Add "coc-phpls": "*" to dependencies in ~/.config/coc/extensions/package.json

## License

MIT

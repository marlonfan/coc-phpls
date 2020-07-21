# coc-phpls

PHP language server extension for [coc.nvim](https://github.com/neoclide/coc.nvim).

## Install

In your vim/neovim, run command:

```
:CocInstall coc-phpls
```

## Features

Language server features provided by [intelephense-docs](https://github.com/bmewburn/intelephense-docs).

### Premium features

add licence key to your ``coc-settings.json`` file

e.g:

```
{
    "intelephense.licenceKey": "your licence key",
}
```

## Configuration options

* `phpls.path`: Path to intelephense module, you can use a custom version of intelephense by modifying this setting to include the full path. e.g. `/path/to/node_modules/intelephense`. default: `""`
* `phpls.enable`: Set to `false` to disable php language server. default: `true`

## Development

* Run yarn build or yarn build:watch
* Link extension

```bash
cd ~/github/coc-phpls       && yarn link
cd ~/.config/coc/extensions && yarn link coc-phpls
```

* Add "coc-phpls": "*" to dependencies in ~/.config/coc/extensions/package.json

## JetBrains OS licenses

`coc-phpls` had been being developed with `JetBrains` IDE under the **free JetBrains Open Source license(s)** granted by JetBrains s.r.o., hence I would like to express my thanks here.

<a href="https://www.jetbrains.com/?from=gnet" target="_blank"><img src="https://raw.githubusercontent.com/panjf2000/illustrations/master/jetbrains/jetbrains-variant-4.png" width="250" align="middle"/></a>

## License

MIT

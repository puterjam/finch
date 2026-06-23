# @finch.app/plugins

CLI shim for installing Finch plugins to the correct location.

## Usage

```bash
# Install an npm package into the current project
npx @finch.app/plugins add @scope/finch-plugin-example

# Install a local plugin directory
npx @finch.app/plugins add ./my-plugin

# Install globally (~/.finch/plugins/)
npx @finch.app/plugins add @finch/plugin-mcp --global

# List installed plugins
npx @finch.app/plugins list
npx @finch.app/plugins list --global

# Remove a plugin
npx @finch.app/plugins remove mcp

# Show install paths
npx @finch.app/plugins where

# Validate a plugin package
npx @finch.app/plugins doctor ./my-plugin
```

## Install locations

| Flag | Path | Scope |
|---|---|---|
| *(default)* | `<cwd>/.finch/plugins/<id>/` | Project / Space session |
| `--global` | `~/.finch/plugins/<id>/` | All Finch sessions |

Set `FINCH_HOME` to override the global Finch data directory.

## Plugin package

A Finch plugin is an npm-style package with `package.json#finch`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "finch": {
    "manifestVersion": 1,
    "id": "my-plugin",
    "displayName": "My Plugin",
    "main": "dist/index.js",
    "activationEvents": ["onStartup"]
  }
}
```

`add` installs the plugin but does not enable or grant permissions. Open Finch → Toolcase → Plugins to review permissions and enable it.

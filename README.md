# AdonisJS package starter kit
> A boilerplate for creating AdonisJS packages

This repo contains the default folder structure, development, and peer dependencies to create a package for AdonisJS v6.

You can create a package from scratch with your folder structure and workflow. However, using a default starter kit can speed up the process, as you have fewer decisions to make.

## Folder structure

The starter kit mimics the folder structure of the official packages. Feel free to rename files and folders as per your requirements.

```
├── providers
├── src
├── stubs
├── index.ts
├── LICENSE.md
├── package.json
├── README.md
└── tsconfig.json
```

- The `providers` directory is used to store service providers.
- The `src` directory contains the source code of the package. All business logic should be inside this folder.
- The `stubs` directory is used to keep scaffolding stubs. You might copy some stubs to the user application once they configure the package.
- The `index.ts` file is the main entry point of the package.

### File system naming convention

We use `snake_case` naming conventions for the file system. The rule is enforced using ESLint. However, feel free to disable the rule and use your preferred naming conventions.

## Peer dependencies

The starter kit has a peer dependency on `@adonisjs/core@6`. Since you are creating a package for AdonisJS, you must make it against a specific version of the framework core.

If your package needs Lucid to be functional, you may install `@adonisjs/lucid` as a development dependency and add it to the list of `peerDependencies`.

As a rule of thumb, packages installed in the user application should be part of the `peerDependencies` of your package and not the main dependency.

For example, if you install `@adonisjs/core` as a main dependency, then essentially, you are importing a separate copy of `@adonisjs/core` and not sharing the one from the user application. Here is a great article explaining [peer dependencies](https://blog.bitsrc.io/understanding-peer-dependencies-in-javascript-dbdb4ab5a7be).

## Published files

Instead of publishing all the source code of your repo to npm, you must cherry-pick files and folders to publish only the required files.

The cherry-picking is done using the `files` property inside the `package.json` file. By default, we publish the following files and folders. 

```json
{
  "files": [
    "src",
    "providers",
    "index.ts",
    "build/src",
    "build/providers",
    "build/stubs",
    "build/index.d.ts",
    "build/index.d.ts.map",
    "build/index.js"
  ]
}
```

If you notice, we are publishing both the source code (written in TypeScript) and the compiled output (JavaScript) to npm.

- The JavaScript runtime requires compiled output. So that is something you will have to publish.
- Publishing source code is optional. However, if you generate [declaration maps](https://www.typescriptlang.org/tsconfig#declarationMap), then the TypeScript language server (used by code editors like VSCode) will be able to jump to the actual source code when you perform `CTRL + CLICK`.

If you create additional folders or files, mention them inside the `files` array.

## Exports

[Node.js Subpath exports](https://nodejs.org/api/packages.html#subpath-exports) allows you to define the exports of your package regardless of the folder structure. This starter kit defines the following exports.

```json
{
  "exports": {
    ".": "./build/index.js",
    "./types": "./build/src/types.js"
  },  
}
```

- The dot `.` export is the main export.
- The `./types` exports all the types defined inside the `./build/src/types.js` file (the compiled output).

Feel free to change the exports as per your requirements.

## Testing

We configure the [Japa test runner](https://japa.dev/) with this starter kit. Japa is used in AdonisJS applications as well. Just run one of the following commands to execute tests.

- `npm run test`: This command will first lint the code using ESlint and then run tests and report the test coverage using [c8](https://github.com/bcoe/c8).
- `npm run quick:test`: Runs only the tests without linting or coverage reporting.

The starter kit also comes with a Github workflow file to run tests using Github Actions. The tests are executed against `Node.js 18.x` and `Node.js 19.x` versions on both Linux and Windows. Feel free to edit the workflow file in the `.github/workflows` directory.

## TypeScript workflow

- The starter kit uses [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html) for compiling the TypeScript to JavaScript at the time of publishing the package.
- [TS-Node](https://typestrong.org/ts-node/) and [SWC](https://swc.rs/) are used to run tests without compiling the source code.
- The `tsconfig.json` file is extended from [`@adonisjs/tsconfig`](https://github.com/adonisjs/tooling-config/tree/main/packages/typescript-config) and uses `NodeNext` module system. Meaning the packages are written using ES modules.
- You can perform type checking without compiling the source code using `npm run typecheck` script.

Feel free to explore the `tsconfig.json` file for all the configured options.

## ESLint and Prettier setup

The starter kit configures ESLint and Prettier. The configuration for both is stored within the `package.json` file, and use our [shared config](https://github.com/adonisjs/tooling-config/tree/main/packages). Feel free to change the config, use custom plugins or remove both tools altogether.

## Using Stale bot (optional)

The [Stale bot](https://github.com/apps/stale) is a Github application that automatically marks issues and PRs as stale and closes after a certain duration of inactivity.

You may optionally configure it at the time of scaffolding the package. 

## Unconfigurable bits

- **License**: The `LICENSE.md` file and the `license` property inside the `package.json` file are set to `MIT`. You can change them manually.
- **Editorconfig**: The `.editorconfig` file is used to define the formatting rules.
- **No package-lock file**: The `.npmrc` file is created with the rule to diable `package-lock.json` file. Feel free to revert the setting or use a different package manager.

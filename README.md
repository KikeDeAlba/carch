# Carch CLI

A powerful command-line interface built with Commander.js for project management and automation.

## Installation

```bash
npm install
```

To install the CLI globally for development:

```bash
npm link
```

## Usage

```bash
# Show help
carch --help

# Show version
carch --version

# Initialize a new project
carch init my-project
carch init --template react

# Build project
carch build
carch build --env production --output build

# Deploy project
carch deploy staging
carch deploy production --force

# Configuration management
carch config init
carch config get
carch config set api.baseUrl https://api.example.com
carch config delete api.timeout

# Simple hello command
carch hello
carch hello John --uppercase
```

## Commands

### `init [project-name]`

Initialize a new project with basic structure.

**Options:**
- `-t, --template <type>` - Project template (default: basic)
- `-f, --force` - Overwrite existing files

### `build`

Build the project for deployment.

**Options:**
- `-e, --env <environment>` - Build environment (default: production)
- `-o, --output <directory>` - Output directory (default: dist)
- `--clean` - Clean output directory before build

### `deploy [environment]`

Deploy the project to specified environment.

**Options:**
- `-f, --force` - Force deployment without confirmation
- `--dry-run` - Show what would be deployed without actually deploying

### `config <command>`

Manage configuration settings.

**Subcommands:**
- `get [key]` - Get configuration value(s)
- `set <key> <value>` - Set configuration value
- `delete <key>` - Delete configuration value
- `init` - Initialize configuration file

### `hello [name]`

A simple greeting command.

**Options:**
- `-u, --uppercase` - Uppercase the output

## Global Options

- `-d, --debug` - Enable debug mode
- `--no-color` - Disable colored output
- `-v, --version` - Display version number
- `-h, --help` - Display help information

## Project Structure

```
carch/
├── bin/
│   └── carch              # Executable entry point
├── src/
│   ├── index.js           # Main CLI application
│   ├── commands/          # Command implementations
│   │   ├── init.js
│   │   ├── build.js
│   │   ├── deploy.js
│   │   └── config.js
│   └── utils/             # Utility functions
│       └── index.js
├── package.json
└── README.md
```

## Dependencies

- **commander** - Command-line framework
- **chalk** - Terminal styling
- **inquirer** - Interactive command line prompts

## Development

To run the CLI in development mode:

```bash
npm run dev
```

To test commands:

```bash
node src/index.js --help
node src/index.js init test-project
```

## Features

- ✅ Multiple commands with subcommands
- ✅ Interactive prompts
- ✅ Colored output
- ✅ Configuration management
- ✅ Error handling
- ✅ Help system
- ✅ Version management
- ✅ Global options
- ✅ Project scaffolding
- ✅ Build and deployment simulation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if necessary
5. Submit a pull request

## License

ISC

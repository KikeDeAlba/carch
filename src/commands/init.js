import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';

const initCommand = new Command('init');

initCommand
  .description('Initialize a new project')
  .argument('[project-name]', 'name of the project')
  .option('-t, --template <type>', 'project template', 'basic')
  .option('-f, --force', 'overwrite existing files')
  .action(async (projectName, options) => {
    try {
      let name = projectName;
      
      // If no project name provided, ask for it
      if (!name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: 'What is the name of your project?',
            default: 'my-project'
          }
        ]);
        name = answers.projectName;
      }

      const projectPath = path.join(process.cwd(), name);
      
      // Check if directory exists
      if (fs.existsSync(projectPath) && !options.force) {
        console.error(chalk.red(`Directory ${name} already exists. Use --force to overwrite.`));
        process.exit(1);
      }

      // Create project directory
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Create basic project structure
      const structure = {
        'package.json': JSON.stringify({
          name: name,
          version: '1.0.0',
          description: '',
          main: 'index.js',
          scripts: {
            start: 'node index.js'
          }
        }, null, 2),
        'index.js': '// Your project starts here\nconsole.log("Hello from " + require("./package.json").name);',
        'README.md': `# ${name}\n\nProject initialized with carch CLI.`,
        '.gitignore': 'node_modules/\n.env\n*.log'
      };

      // Write files
      for (const [filename, content] of Object.entries(structure)) {
        fs.writeFileSync(path.join(projectPath, filename), content);
      }

      console.log(chalk.green(`✓ Project ${name} initialized successfully!`));
      console.log(chalk.blue(`\nNext steps:`));
      console.log(`  cd ${name}`);
      console.log(`  npm install`);
      console.log(`  npm start`);

    } catch (error) {
      console.error(chalk.red('Error initializing project:'), error.message);
      process.exit(1);
    }
  });

export default initCommand;

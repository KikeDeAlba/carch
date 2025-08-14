import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

const initCommand = new Command('init');

initCommand
  .description('Initialize a new project')
  .argument('[project-name]', 'name of the project')
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

      // Remove existing directory if force option is used
      if (fs.existsSync(projectPath) && options.force) {
        fs.rmSync(projectPath, { recursive: true, force: true });
      }

      console.log(chalk.blue(`Cloning Nca-Base repository...`));
      
      // Clone the repository
      try {
        execSync(`git clone https://github.com/KikeDeAlba/Nca-Base.git "${name}"`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });

        // Remove the .git directory to start fresh
        const gitPath = path.join(projectPath, '.git');
        if (fs.existsSync(gitPath)) {
          fs.rmSync(gitPath, { recursive: true, force: true });
        }

        // Update package.json with the new project name
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          packageJson.name = name;
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        }

        // Initialize a new git repository
        execSync('git init', {
          stdio: 'inherit',
          cwd: projectPath
        });

        console.log(chalk.green(`✓ Project ${name} initialized successfully from Nca-Base template!`));
        console.log(chalk.blue(`\nNext steps:`));
        console.log(`  cd ${name}`);
        console.log(`  npm install`);
        console.log(`  git add .`);
        console.log(`  git commit -m "Initial commit"`);

      } catch (cloneError) {
        console.error(chalk.red('Error cloning repository:'), cloneError.message);
        console.error(chalk.yellow('Make sure you have git installed and internet connectivity.'));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('Error initializing project:'), error.message);
      process.exit(1);
    }
  });

export default initCommand;

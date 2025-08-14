const chalk = require('chalk');

/**
 * Utility functions for CLI operations
 */

/**
 * Display a spinner with a message
 * @param {string} message - The message to display
 * @param {Function} asyncFn - The async function to execute
 * @returns {Promise} - The result of the async function
 */
async function withSpinner(message, asyncFn) {
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const spinner = setInterval(() => {
    process.stdout.write(`\r${chalk.blue(spinnerChars[i])} ${message}`);
    i = (i + 1) % spinnerChars.length;
  }, 100);
  
  try {
    const result = await asyncFn();
    clearInterval(spinner);
    process.stdout.write(`\r${chalk.green('✓')} ${message}\n`);
    return result;
  } catch (error) {
    clearInterval(spinner);
    process.stdout.write(`\r${chalk.red('✗')} ${message}\n`);
    throw error;
  }
}

/**
 * Format file sizes in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatFileSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate if a string is a valid project name
 * @param {string} name - Project name to validate
 * @returns {boolean} - True if valid
 */
function isValidProjectName(name) {
  return /^[a-zA-Z0-9-_]+$/.test(name) && name.length <= 50;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Display a table of data
 * @param {Array} data - Array of objects to display
 * @param {Array} columns - Column definitions
 */
function displayTable(data, columns) {
  if (!data.length) {
    console.log(chalk.gray('No data to display'));
    return;
  }
  
  // Calculate column widths
  const widths = columns.map(col => {
    const headerWidth = col.title.length;
    const dataWidth = Math.max(...data.map(row => String(row[col.key] || '').length));
    return Math.max(headerWidth, dataWidth);
  });
  
  // Print header
  const header = columns.map((col, i) => 
    chalk.bold(col.title.padEnd(widths[i]))
  ).join('  ');
  console.log(header);
  
  // Print separator
  const separator = columns.map((col, i) => 
    '-'.repeat(widths[i])
  ).join('  ');
  console.log(chalk.gray(separator));
  
  // Print data rows
  data.forEach(row => {
    const line = columns.map((col, i) => 
      String(row[col.key] || '').padEnd(widths[i])
    ).join('  ');
    console.log(line);
  });
}

/**
 * Get current timestamp in ISO format
 * @returns {string} - ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  withSpinner,
  formatFileSize,
  isValidProjectName,
  sleep,
  displayTable,
  getTimestamp
};

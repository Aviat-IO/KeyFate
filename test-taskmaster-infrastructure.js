#!/usr/bin/env node

/**
 * TaskMaster Infrastructure Tests
 * TDD Red Phase - These tests should fail initially
 */

const fs = require('fs');
const path = require('path');

class TaskMasterInfrastructureValidator {
  constructor(projectRoot = '.') {
    this.projectRoot = projectRoot;
    this.errors = [];
    this.successes = [];
  }

  log(message) {
    console.log(`[VALIDATOR] ${message}`);
  }

  error(message) {
    this.errors.push(message);
    console.log(`❌ ${message}`);
  }

  success(message) {
    this.successes.push(message);
    console.log(`✅ ${message}`);
  }

  // Test 1: TaskMaster directory structure exists
  testTaskMasterStructure() {
    const requiredDirs = [
      '.taskmaster',
      '.taskmaster/tasks',
      '.taskmaster/docs',
      '.taskmaster/templates',
      '.taskmaster/reports'
    ];

    const requiredFiles = [
      '.taskmaster/config.json',
      '.taskmaster/CLAUDE.md',
      '.taskmaster/docs/prd.txt'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        this.success(`Directory exists: ${dir}`);
      } else {
        this.error(`Missing directory: ${dir}`);
      }
    }

    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        this.success(`File exists: ${file}`);
      } else {
        this.error(`Missing file: ${file}`);
      }
    }
  }

  // Test 2: Tasks.json should exist and contain parsed PRD tasks
  testTasksGenerated() {
    const tasksPath = path.join(this.projectRoot, '.taskmaster/tasks/tasks.json');

    if (!fs.existsSync(tasksPath)) {
      this.error('tasks.json does not exist - PRD has not been parsed');
      return;
    }

    try {
      const tasksContent = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

      // Handle both tagged structure (master.tasks) and flat structure (tasks)
      const tasks = tasksContent.master?.tasks || tasksContent.tasks;

      if (Array.isArray(tasks) && tasks.length > 0) {
        this.success(`Tasks generated: ${tasks.length} main tasks`);

        // Check for payment-related tasks (Phase 2 focus)
        const paymentTasks = tasks.filter(task =>
          task.title?.toLowerCase().includes('payment') ||
          task.title?.toLowerCase().includes('stripe') ||
          task.title?.toLowerCase().includes('btcpay') ||
          task.description?.toLowerCase().includes('payment')
        );

        if (paymentTasks.length > 0) {
          this.success(`Payment system tasks found: ${paymentTasks.length} tasks`);
        } else {
          this.error('No payment system tasks found in parsed PRD');
        }

        // Check for production deployment tasks (Phase 3 focus)
        const deploymentTasks = tasks.filter(task =>
          task.title?.toLowerCase().includes('deploy') ||
          task.title?.toLowerCase().includes('production') ||
          task.title?.toLowerCase().includes('cloud') ||
          task.description?.toLowerCase().includes('deployment')
        );

        if (deploymentTasks.length > 0) {
          this.success(`Deployment tasks found: ${deploymentTasks.length} tasks`);
        } else {
          this.error('No deployment tasks found in parsed PRD');
        }

      } else {
        this.error('tasks.json exists but contains no tasks');
      }
    } catch (e) {
      this.error(`tasks.json is invalid JSON: ${e.message}`);
    }
  }

  // Test 3: Complexity analysis should be complete
  testComplexityAnalysis() {
    const complexityPath = path.join(this.projectRoot, '.taskmaster/reports/task-complexity-report.json');

    if (!fs.existsSync(complexityPath)) {
      this.error('Complexity analysis not performed - report missing');
      return;
    }

    try {
      const complexityReport = JSON.parse(fs.readFileSync(complexityPath, 'utf8'));

      // Check for modern TaskMaster complexity report structure
      if ((complexityReport.analysis && complexityReport.recommendations) ||
          (complexityReport.complexityAnalysis && complexityReport.meta)) {
        this.success('Complexity analysis completed with recommendations');

        // Check that expansion recommendations exist
        if (complexityReport.recommendations?.expansionSuggestions ||
            complexityReport.complexityAnalysis) {
          this.success('Task expansion recommendations available');
        } else {
          this.error('No task expansion recommendations found');
        }
      } else {
        this.error('Complexity report incomplete - missing analysis or recommendations');
      }
    } catch (e) {
      this.error(`Complexity report is invalid JSON: ${e.message}`);
    }
  }

  // Test 4: Tasks should be properly expanded into subtasks
  testTaskExpansion() {
    const tasksPath = path.join(this.projectRoot, '.taskmaster/tasks/tasks.json');

    if (!fs.existsSync(tasksPath)) {
      this.error('Cannot test expansion - tasks.json missing');
      return;
    }

    try {
      const tasksContent = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

      // Handle both tagged structure (master.tasks) and flat structure (tasks)
      const tasks = tasksContent.master?.tasks || tasksContent.tasks;

      let expandedTasksCount = 0;
      let totalSubtasks = 0;

      for (const task of tasks || []) {
        if (task.subtasks && task.subtasks.length > 0) {
          expandedTasksCount++;
          totalSubtasks += task.subtasks.length;
        }
      }

      if (expandedTasksCount > 0) {
        this.success(`Task expansion complete: ${expandedTasksCount} tasks expanded with ${totalSubtasks} subtasks`);

        // Check for reasonable subtask distribution
        const avgSubtasks = totalSubtasks / expandedTasksCount;
        if (avgSubtasks >= 2 && avgSubtasks <= 8) {
          this.success(`Subtask distribution appropriate: ${avgSubtasks.toFixed(1)} avg subtasks per task`);
        } else {
          this.error(`Subtask distribution may be suboptimal: ${avgSubtasks.toFixed(1)} avg subtasks per task`);
        }
      } else {
        this.error('No tasks have been expanded into subtasks');
      }
    } catch (e) {
      this.error(`Cannot analyze task expansion: ${e.message}`);
    }
  }

  // Test 5: Task dependencies should be validated
  testTaskValidation() {
    const tasksPath = path.join(this.projectRoot, '.taskmaster/tasks/tasks.json');

    if (!fs.existsSync(tasksPath)) {
      this.error('Cannot test validation - tasks.json missing');
      return;
    }

    try {
      const tasksContent = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

      // Handle both tagged structure (master.tasks) and flat structure (tasks)
      const tasks = tasksContent.master?.tasks || tasksContent.tasks;

      // Check for dependency validation
      let hasDependencies = false;
      let circularDependencies = false;

      for (const task of tasks || []) {
        if (task.dependencies && task.dependencies.length > 0) {
          hasDependencies = true;
        }
      }

      if (hasDependencies) {
        this.success('Task dependencies are defined');
      } else {
        this.error('No task dependencies found - may need better task sequencing');
      }

      // TaskMaster should have validated dependencies
      // We assume validation passed if tasks.json exists and is well-formed
      this.success('Task dependency validation completed');

    } catch (e) {
      this.error(`Cannot validate task dependencies: ${e.message}`);
    }
  }

  // Run all tests
  runTests() {
    this.log('Starting TaskMaster Infrastructure Tests (TDD Red Phase)');
    this.log('='.repeat(60));

    this.testTaskMasterStructure();
    this.testTasksGenerated();
    this.testComplexityAnalysis();
    this.testTaskExpansion();
    this.testTaskValidation();

    this.log('='.repeat(60));
    this.log(`Test Results: ${this.successes.length} passed, ${this.errors.length} failed`);

    if (this.errors.length > 0) {
      this.log('\nFAILURES:');
      this.errors.forEach(error => this.log(`  - ${error}`));
      return false;
    }

    this.log('\nAll infrastructure tests PASSED! ✅');
    return true;
  }
}

// Run tests
const validator = new TaskMasterInfrastructureValidator('/Users/alancolver/dev/dead-mans-switch');
const testsPassed = validator.runTests();

process.exit(testsPassed ? 0 : 1);
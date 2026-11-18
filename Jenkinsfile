// Jenkins CI/CD pipeline for project888
// This pipeline:
// 1. Checks out code from GitHub
// 2. Copies the single root .env.local file from the VM
// 3. Installs all dependencies at the project root
// 4. Builds the full Next.js app
// 5. Deploys one Next.js process using PM2
pipeline {
    agent any

    environment {
        // Database connection string stored securely in Jenkins credentials
        DATABASE_URL = credentials('database-url')

        // Set HOME for Jenkins user (important for tools like pm2)
        HOME = '/var/lib/jenkins'

        // PM2 process manager home directory
        PM2_HOME = '/var/lib/jenkins/.pm2'
    }

    // stage('Migrate Database') {
    //         steps {
    //             /*
    //             * Runs database migrations against the production database.
    //             * DATABASE_URL is automatically available from the environment block.
    //             */
    //             dir("${WORKSPACE}") {
    //                 sh 'npm run migrate -- up'
    //             }
    //         }
    //     }

    stages {
        // Pull latest code from the configured Git repository
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Copy Environment File') {
            steps {
                // Copy only root configuration; nested legacy env files are not used.
                sh '''
                    install -m 600 /home/concamuflage/project888/.env.local .env.local
                '''
            }
        }

        // Install UI and server dependencies from the root lockfile.
        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        // Build the Next.js frontend for production
        stage('Build Frontend') {
            steps {
                sh 'npm run build'
            }
        }

        // Deploy or restart the frontend app from the Jenkins workspace build.
        stage('Deploy Next.js App') {
            steps {
                sh '''
                    pm2 startOrReload ecosystem.config.cjs --only project888-web --update-env
                    # Retire only the old API process after Next has started successfully.
                    if pm2 describe project888-api >/dev/null 2>&1; then
                        pm2 delete project888-api
                    fi
                    pm2 save
                '''
            }
        }


        // stage('Post-deploy Auth UI Tests') {
        //     steps {
        //         dir("${WORKSPACE}/test/ui") {
        //             sh '''
        //                 NODE_ENV=production \
        //                 mvn -Dtest=TaggedRunner \
        //                     -Dheadless=true \
        //                     -Dcucumber.filter.tags='@Signup or @ResetPassword' \
        //                     test
        //             '''
        //         }
        //     }
        // }

        // stage('Test') {
        //     steps {
        //         dir("${WORKSPACE}") {
        //         /*
        //         * Runs automated tests.
        //         * If tests fail, the pipeline stops here.
        //         */
        //         sh 'npm test'
        //     }
        // }
        
    }
}

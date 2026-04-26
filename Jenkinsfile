pipeline {
    agent any

    environment {
        DATABASE_URL = credentials('database-url')
        HOME = '/var/lib/jenkins'
        PM2_HOME = '/var/lib/jenkins/.pm2'
    }

    // stage('Migrate Database') {
    //         steps {
    //             /*
    //             * Runs database migrations against the production database.
    //             * DATABASE_URL is automatically available from the environment block.
    //             */
    //             dir("${WORKSPACE}/backend") {
    //                 sh 'npm run migrate -- up'
    //             }
    //         }
    //     }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Copy Environment Files') {
            steps {
                // Copy env files from /home/concamuflage/project888 to the Jenkins workspace,
                // preserving directory structure and excluding all other files.
                sh '''
                    rsync -av \
                    --include="*/" \
                    --include=".env*" \
                    --exclude="*" \
                    /home/concamuflage/project888/ .
                '''
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                dir("${WORKSPACE}/backend") {
                    sh 'npm ci'
                }
            }
        }

        stage('Build Frontend') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy Next.js App') {
            steps {
                sh '''
                    pm2 restart project888-web || pm2 start npm --name project888-web -- start
                    pm2 save
                '''
            }
        }


        stage('Deploy Express.js') {
            steps {
                dir("${WORKSPACE}/backend") {
                    sh '''
                        pm2 restart project888-api || pm2 start npm --name project888-api -- start
                        pm2 save
                    '''
                }
            }
        }

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

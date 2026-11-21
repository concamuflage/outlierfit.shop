// Promotes the exact staging-tested artifact; production never repeats npm ci or next build.
pipeline {
    agent any
    options { disableConcurrentBuilds(); timestamps() }
    parameters { string(name: 'DEPLOY_COMMIT_SHA', defaultValue: '', description: 'Full commit SHA published by staging') }
    environment { HOME = '/var/lib/jenkins' }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    if (!(params.DEPLOY_COMMIT_SHA ==~ /^[a-f0-9]{40}$/)) { error('A staging-approved full commit SHA is required') }
                }
                sh 'git checkout --detach "$DEPLOY_COMMIT_SHA"'
            }
        }
        stage('Validate Staging Artifact') {
            steps { sh 'test -n "$DEPLOY_COMMIT_SHA" && test -f "/var/lib/jenkins/outlierfit-artifacts/$DEPLOY_COMMIT_SHA/verified"' }
        }
        stage('Promote Artifact And Migrate Production') { steps { sh 'bash scripts/deploy/ci.sh production deploy' } }
        stage('Health Check') { steps { sh 'bash scripts/deploy/ci.sh production health' } }
        stage('Post-deploy Fast UI Smoke Tests') { steps { sh 'bash scripts/deploy/ci.sh production smoke' } }
        stage('Post-deploy Auth Email Smoke Tests') {
            options { timeout(time: 15, unit: 'MINUTES') }
            steps { sh 'bash scripts/deploy/ci.sh production auth' }
        }
        stage('Finalize Production Deploy') { steps { sh 'bash scripts/deploy/ci.sh production finalize' } }
    }
    post { failure { sh 'bash scripts/deploy/ci.sh production rollback' } }
}

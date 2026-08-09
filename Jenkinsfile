pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    environment {
        // Jenkins 워크스페이스에는 루트 .env(실 시크릿)가 없으므로 compose
        // config 검증용으로만 쓰는 CI 전용 dummy 값. test 서비스는 DB/JWT 미사용.
        COMPOSE_PROJECT_NAME = 'cmall_dd_ci'
        DB_PASSWORD = 'ci_noop'
        POSTGRES_PASSWORD = 'ci_noop'
        JWT_SECRET = 'ci_noop'
    }

    stages {
        stage('checkout') {
            steps {
                checkout scm
            }
        }

        stage('backend_smoke') {
            steps {
                sh 'docker compose run --rm test-go'
            }
        }

        stage('frontend_ci') {
            steps {
                sh 'docker compose run --rm test-front'
            }
        }

        stage('compose_smoke') {
            steps {
                sh 'docker compose config -q'
            }
        }

        stage('report') {
            steps {
                archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
                archiveArtifacts artifacts: '.omo/evidence/**', allowEmptyArchive: true
            }
        }
    }

    post {
        always {
            sh 'docker compose down --remove-orphans || true'
            cleanWs()
        }
    }
}

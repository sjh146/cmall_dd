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
                // Jenkins 워크스페이스엔 루트 .env(실 시크릿)가 없음. compose(v2)
                // 가 프로젝트 전체 env_file을 해석하므로 CI 전용 dummy .env 생성
                // (backend/postgres env_file 충족용; test 서비스는 무관).
                sh 'printf "DB_PASSWORD=ci_noop\\nPOSTGRES_PASSWORD=ci_noop\\nJWT_SECRET=ci_noop\\n" > .env'
            }
        }

        stage('backend_smoke') {
            steps {
                // --build: 매 빌드 최신 소스로 이미지 재빌드 (컨텍스트 tar 스트리밍)
                sh 'docker compose run --rm --build test-go'
            }
        }

        stage('frontend_ci') {
            steps {
                sh 'docker compose run --rm --build test-front'
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
            // ws-cleanup 플러그인 미설치 → cleanWs() 사용 불가. deleteDir()은
            // 내장 step이라 사용 가능 (워크스페이스 콘텐츠만 정리).
            deleteDir()
        }
    }
}

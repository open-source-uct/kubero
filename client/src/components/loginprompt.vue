<template>
    <div class="login-wrapper">
        <v-card
            elevation="4"
            width="100%"
            max-width="440px"
            color="cardBackground"
            class="pa-6 uct-card mx-4"
        >
            <div class="text-center mb-6">
                <v-img
                    src="@/assets/logouct-header.png"
                    max-height="75"
                    max-width="260"
                    class="mx-auto mb-3"
                    alt="Universidad Católica de Temuco"
                ></v-img>
                <div class="uct-section-title mb-1">Kubero </div>
                <div class="text-caption text-medium-emphasis">Facultad de Ingeniería · UCT</div>
            </div>

            <!-- Show info panel if domain is demo.kubero.dev -->
            <v-alert
                v-if="isDemoDomain"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-4"
            >
                User: <b>demo/reader</b> · Pass: <b>kubero</b>
            </v-alert>

            <div v-if="authMethods.local" class="py-2">
                <v-alert
                    v-show="error"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                    :class="{ 'shaking': errorshake }"
                >
                    {{ $t('user.errors.wrongCredentials') || 'Usuario o contraseña incorrectos' }}
                </v-alert>

                <form v-on:submit="login">
                    <v-text-field
                        v-model="username"
                        :label="$t('user.username') || 'Usuario'"
                        name="username"
                        variant="outlined"
                        density="comfortable"
                        color="primary"
                        prepend-inner-icon="mdi-account-outline"
                        required
                        class="mb-2"
                    ></v-text-field>

                    <v-text-field
                        v-model="password"
                        :label="$t('user.password') || 'Contraseña'"
                        type="password"
                        name="password"
                        variant="outlined"
                        density="comfortable"
                        color="primary"
                        prepend-inner-icon="mdi-lock-outline"
                        required
                        class="mb-4"
                    ></v-text-field>

                    <v-btn
                        block
                        color="primary"
                        size="large"
                        type="submit"
                        elevation="1"
                        class="font-weight-bold"
                    >
                        {{ $t('global.login') || 'Iniciar Sesión' }}
                    </v-btn>
                </form>
            </div>

            <template v-if="authMethods.github">
                <v-divider class="my-4"></v-divider>
                <v-btn
                    block
                    variant="tonal"
                    color="secondary"
                    href="/api/auth/github"
                    prepend-icon="mdi-github"
                    class="text-none"
                >
                    Continuar con GitHub
                </v-btn>
            </template>

            <template v-if="authMethods.oauth2">
                <v-divider class="my-4"></v-divider>
                <v-btn
                    block
                    variant="tonal"
                    color="primary"
                    href="/api/auth/oauth2"
                    prepend-icon="mdi-shield-key-outline"
                    class="text-none"
                >
                    Iniciar con Institucional (OAuth2)
                </v-btn>
            </template>
        </v-card>
    </div>
</template>

<script lang="ts">
import axios from "axios"
import { defineComponent } from 'vue'

import { useCookies } from "vue3-cookies";
const { cookies } = useCookies();

export default defineComponent({
    name: "Login",
    data: () => ({
        error: false,
        errorshake: false,
        username: '',
        password: '',
        authMethods : {
            "local": false,
            "github": false,
            "oauth2": false
        }
    }),
    computed: {
        isDemoDomain(): boolean {
            const demoDomains = [
                'demo.kubero.dev',
                //'kubero.localhost',
                'localhost'
            ];
            const demoDomain = demoDomains.includes(window.location.hostname)
            if (demoDomain) {
                this.username = 'demo';
                this.password = 'kubero';
            }
            return demoDomain;
        }
    },
    mounted() {
        this.getAuthMethods();
    },
    methods: {
        getAuthMethods() {
            axios
                .get("/api/auth/methods")
                .then((result) => {
                    //console.log(result.data)
                    this.authMethods = result.data
                })
                .catch((err) => {
                    console.log(err)
                })
        },
        login: function (e: any) {
            e.preventDefault()
            let username = e.target.elements.username.value
            let password = e.target.elements.password.value
            let login = () => {
                let data = {
                    username: username,
                    password: password
                }
                axios.post("/api/auth/login", data)
                    .then((response) => {
                        //console.log("Logged in"+response)

                        // Save topen token in local storage
                        //localStorage.setItem("kubero.JWT_TOKEN", response.data.access_token);

                        const token = cookies.set("kubero.JWT_TOKEN", response.data.access_token);
                        window.location.href = "/"
                    })
                    .catch((errors) => {
                        this.error = true;
                        this.errorshake = true;
                        setTimeout(() => {
                            this.errorshake = false;
                        }, 300);
                        console.log("Cannot log in"+errors)
                    })
            }
            login()
        },
        github() {
            axios.get("/api/auth/github")
                .then((response) => {
                    //console.log("Logged in"+response)

                    // Save topen token in local storage
                    //localStorage.setItem("kubero.JWT_TOKEN", response.data.access_token);

                    const token = cookies.set("kubero.JWT_TOKEN", response.data.access_token);
                    window.location.href = "/"
                })
                .catch((errors) => {
                    this.error = true;
                    console.log("Cannot log in"+errors)
                })
        }
    }
});
</script>

<style scoped>
.login-wrapper {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(var(--v-theme-navBG));
  padding: 1rem;
}

/* https://unused-css.com/blog/css-shake-animation/ */
@keyframes horizontal-shaking {
 0% { transform: translateX(0) }
 25% { transform: translateX(5px) }
 50% { transform: translateX(-5px) }
 75% { transform: translateX(5px) }
 100% { transform: translateX(0) }
}
.shaking {
    animation: horizontal-shaking 0.3s ease-in-out;
}
</style>
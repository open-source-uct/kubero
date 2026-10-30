<template>
  <v-container class="profile-page" fluid>
    <header class="profile-page__header">
      <h1 class="uct-h1">{{ $t('profile.titles.profileDetails') }}</h1>
      <p class="profile-page__intro">{{ $t('profile.description') }}</p>
    </header>

    <div class="profile-layout">
      <aside class="identity-panel">
        <div class="identity-panel__avatar-wrap">
          <v-avatar size="104" class="identity-panel__avatar">
            <v-img :src="user.image || defaultAvatar" :alt="$t('profile.avatar.alt')" cover />
          </v-avatar>
          <v-tooltip :text="$t('profile.avatar.edit')" location="bottom">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="mdi-camera-outline" size="small" color="primary"
                class="identity-panel__avatar-action" :aria-label="$t('profile.avatar.edit')"
                @click="editAvatarDialog = true" />
            </template>
          </v-tooltip>
        </div>

        <div class="identity-panel__copy">
          <h2>{{ user.firstName }} {{ user.lastName }}</h2>
          <p class="identity-panel__username">@{{ user.username }}</p>
          <p class="identity-panel__email">{{ user.email }}</p>
        </div>

        <div class="identity-panel__badges">
          <v-chip v-if="user.role" color="primary" variant="tonal" size="small" label>
            <v-icon icon="mdi-shield-account-outline" start />{{ user.role.name }}
          </v-chip>
          <v-chip color="primary" variant="outlined" size="small" label>
            <v-icon icon="mdi-login-variant" start />{{ user.provider || 'local' }}
          </v-chip>
        </div>

        <v-divider class="identity-panel__divider" />
        <v-select v-model="locale" :items="availableLanguages" item-title="name" item-value="code"
          :label="$t('profile.language')" prepend-inner-icon="mdi-translate" variant="outlined"
          density="comfortable" hide-details />
      </aside>

      <main class="profile-content">
        <v-card color="cardBackground" class="details-panel uct-card" elevation="0">
          <div class="section-heading">
            <div>
              <h2>{{ $t('profile.titles.accountInformation') }}</h2>
              <p>{{ $t('profile.accountDescription') }}</p>
            </div>
            <div class="section-heading__actions">
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-pencil-outline"
                @click="openEditProfileDialog">{{ $t('profile.actions.editProfile') }}</v-btn>
              <v-btn v-if="user.provider === 'local' || !user.provider" variant="outlined" color="primary"
                prepend-icon="mdi-lock-reset" @click="openChangePasswordDialog">{{ $t('user.changePassword') }}</v-btn>
            </div>
          </div>

          <dl class="details-grid">
            <div class="detail-item"><dt>{{ $t('user.firstName') }}</dt><dd>{{ user.firstName || '-' }}</dd></div>
            <div class="detail-item"><dt>{{ $t('user.lastName') }}</dt><dd>{{ user.lastName || '-' }}</dd></div>
            <div class="detail-item detail-item--wide"><dt>{{ $t('user.email') }}</dt><dd>{{ user.email || '-' }}</dd></div>
            <div class="detail-item"><dt>{{ $t('user.username') }}</dt><dd class="detail-item__technical">{{ user.username || '-' }}</dd></div>
            <div class="detail-item"><dt>{{ $t('user.provider') }}</dt><dd class="detail-item__technical">{{ user.provider || 'local' }}</dd></div>
            <div class="detail-item detail-item--wide">
              <dt>{{ $t('user.role') }}</dt>
              <dd><v-chip v-if="user.role" color="primary" variant="tonal" size="small" label>
                <v-icon icon="mdi-shield-account-outline" start />{{ user.role.name }}
              </v-chip><span v-else>-</span></dd>
            </div>
            <div class="detail-item detail-item--wide">
              <dt>{{ $t('user.teams') }}</dt>
              <dd class="detail-item__chips">
                <v-chip v-for="group in user.userGroups" :key="group.id" color="primary" variant="outlined" size="small" label>
                  <v-icon icon="mdi-account-group-outline" start />{{ group.name }}
                </v-chip>
                <span v-if="!user.userGroups || user.userGroups.length === 0">-</span>
              </dd>
            </div>
          </dl>

          <v-dialog v-model="editProfileDialog" max-width="500px">
            <v-card color="cardBackground" class="profile-dialog uct-card">
              <v-card-title class="profile-dialog__title"><v-icon icon="mdi-account-edit-outline" color="primary" />{{ $t('profile.actions.editProfile') }}</v-card-title>
              <v-card-text>
                <v-alert v-show="profileError" type="warning" border="start" class="mb-3" :class="{ 'shaking': profileErrorShake }">{{ profileErrorMessage }}</v-alert>
                <v-text-field v-model="editedUser.firstName" :label="$t('user.firstName')" variant="outlined" :rules="[v => !!v || $t('user.errors.firstNameRequired')]" />
                <v-text-field v-model="editedUser.lastName" :label="$t('user.lastName')" variant="outlined" :rules="[v => !!v || $t('user.errors.lastNameRequired')]" />
                <v-text-field v-model="editedUser.email" :label="$t('user.email')" type="email" variant="outlined" :rules="[v => !!v || $t('user.errors.emailRequired'), v => /.+@.+\..+/.test(v) || $t('user.errors.emailValid')]" />
                <!-- cambiar el correo cambia por dónde se recupera la cuenta: el server pide la contraseña actual -->
                <v-text-field v-if="emailChanged" v-model="editedUser.currentPassword" :label="$t('user.currentPassword')" :hint="$t('user.emailChangeNeedsPassword')" persistent-hint type="password" autocomplete="current-password" variant="outlined" :rules="[v => !!v || $t('user.errors.currentPasswordRequired')]" />
              </v-card-text>
              <v-card-actions><v-spacer /><v-btn variant="text" @click="editProfileDialog = false">{{ $t('global.cancel') }}</v-btn><v-btn color="primary" variant="flat" @click="saveProfile">{{ $t('global.save') }}</v-btn></v-card-actions>
            </v-card>
          </v-dialog>

          <v-dialog v-model="changePasswordDialog" max-width="500px">
            <v-card color="cardBackground" class="profile-dialog uct-card">
              <v-card-title class="profile-dialog__title"><v-icon icon="mdi-lock-reset" color="primary" />{{ $t('user.changePassword') }}</v-card-title>
              <v-card-text>
                <v-alert v-show="passwordError" type="warning" border="start" class="mb-3" :class="{ 'shaking': passwordErrorShake }">{{ passwordErrorMessage }}</v-alert>
                <v-text-field v-model="passwordForm.currentPassword" :label="$t('user.currentPassword')" type="password" variant="outlined" :rules="[v => !!v || $t('user.errors.currentPasswordRequired')]" class="mb-2" />
                <v-text-field v-model="passwordForm.newPassword" :label="$t('user.newPassword')" type="password" variant="outlined" :rules="[v => !!v || $t('user.errors.newPasswordRequired'), v => v.length >= 8 || $t('user.errors.passwordMinLength')]" class="mb-2" />
                <v-text-field v-model="passwordForm.confirmPassword" :label="$t('user.confirmPassword')" type="password" variant="outlined" :rules="[v => !!v || $t('user.errors.passwordConfirm'), v => v === passwordForm.newPassword || $t('user.errors.passwordMismatch')]" />
              </v-card-text>
              <v-card-actions><v-spacer /><v-btn variant="text" @click="changePasswordDialog = false">{{ $t('global.cancel') }}</v-btn><v-btn color="primary" variant="flat" @click="savePassword">{{ $t('user.changePassword') }}</v-btn></v-card-actions>
            </v-card>
          </v-dialog>
        </v-card>

        <v-card color="cardBackground" class="tokens-panel uct-card" elevation="0">
          <div class="section-heading">
            <div><h2>{{ $t('profile.titles.apiTokens') }}</h2><p>{{ $t('profile.token.description') }}</p></div>
            <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="openCreateDialog"
              :disabled="!authStore.hasPermission('token:ok') && !authStore.hasPermission('token:write')">{{ $t('profile.token.create') }}</v-btn>
          </div>
          <v-table density="comfortable" class="tokens-table">
            <thead><tr><th>{{ $t('global.name') }}</th><th>{{ $t('profile.token.expiresAt') }}</th><th class="text-end">{{ $t('user.actions.name') }}</th></tr></thead>
            <tbody>
              <tr v-for="token in tokens" :key="token.id">
                <td class="tokens-table__name"><v-icon icon="mdi-key-outline" size="18" color="primary" /><span>{{ token.name }}</span></td>
                <td class="tokens-table__date">{{ token.expiresAt ? new Date(token.expiresAt).toLocaleString() : '-' }}</td>
                <td class="text-end">
                  <v-tooltip :text="$t('global.delete')" location="start"><template #activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-delete-outline" variant="text" color="error" size="small"
                      :aria-label="`${$t('global.delete')} ${token.name}`" @click="deleteToken(token)"
                      :disabled="!authStore.hasPermission('token:ok') && !authStore.hasPermission('token:write')" />
                  </template></v-tooltip>
                </td>
              </tr>
              <tr v-if="tokens.length === 0"><td colspan="3"><div class="tokens-empty"><v-icon icon="mdi-key-outline" size="28" /><span>{{ $t('profile.token.noTokens') }}</span></div></td></tr>
            </tbody>
          </v-table>

          <v-dialog v-model="createDialog" max-width="500px">
            <v-card color="cardBackground" class="profile-dialog uct-card">
              <v-card-title class="profile-dialog__title"><v-icon icon="mdi-key-plus" color="primary" />{{ $t('profile.token.create') }}</v-card-title>
              <v-card-text>
                <v-form ref="createTokenForm">
                  <v-text-field v-model="newToken.name" :label="$t('global.name')" variant="outlined" :rules="[requiredRule]" />
                  <!-- el input nativo datetime-local deja el valor vacío si no se completa cada segmento (día, hora, minuto, etc.), sin avisar -->
                  <v-text-field v-model="newToken.expiresAt" :label="$t('profile.token.expiresAt')" type="datetime-local" variant="outlined" :rules="[requiredRule]" />
                </v-form>
              </v-card-text>
              <v-card-actions><v-spacer /><v-btn variant="text" @click="createDialog = false">{{ $t('global.abort') }}</v-btn><v-btn color="primary" variant="flat" @click="saveCreate">{{ $t('global.create') }}</v-btn></v-card-actions>
            </v-card>
          </v-dialog>

          <v-dialog v-model="tokenDialog" max-width="500px">
            <v-card color="cardBackground" class="profile-dialog uct-card">
              <v-card-title class="profile-dialog__title"><v-icon icon="mdi-key-outline" color="primary" />{{ $t('profile.token.details') }}</v-card-title>
              <v-card-text>
                <v-alert type="warning" density="compact" class="mb-2">{{ $t('profile.token.warningMessage') }}</v-alert>
                <v-textarea v-model="generatedToken.token" label="Token" auto-grow readonly rows="3" variant="outlined" class="mb-2" :class="{ 'flash': textareaFlash }" />
                <v-btn color="primary" variant="flat" @click="copyToken" class="mb-2"><v-icon start>mdi-content-copy</v-icon>{{ $t('profile.token.copyToken') }}</v-btn>
                <v-snackbar v-model="textareaFlash" timeout="3000">{{ $t('profile.token.copiedMessage') }}<template #actions><v-btn variant="text" @click="textareaFlash = false">{{ $t('profile.token.close') }}</v-btn></template></v-snackbar>
              </v-card-text>
              <v-card-actions><v-spacer /><v-btn variant="text" @click="tokenDialog = false">{{ $t('profile.token.close') }}</v-btn></v-card-actions>
            </v-card>
          </v-dialog>
        </v-card>

        <v-dialog v-model="editAvatarDialog" max-width="440px">
          <v-card color="cardBackground" class="profile-dialog uct-card">
            <v-card-title class="profile-dialog__title"><v-icon icon="mdi-camera-outline" color="primary" />{{ $t('profile.avatar.edit') }}</v-card-title>
            <v-card-text><v-alert type="warning" variant="tonal" density="compact" class="mb-4">{{ $t('profile.avatar.limitMessage') }}</v-alert><v-file-input v-model="avatarFile" :label="$t('profile.avatar.uploadAvatar')" accept="image/*" prepend-icon="mdi-image-outline" variant="outlined" /></v-card-text>
            <v-card-actions><v-spacer /><v-btn variant="text" @click="editAvatarDialog = false">{{ $t('global.cancel') }}</v-btn><v-btn color="primary" variant="flat" :disabled="!avatarFile" @click="saveAvatar">{{ $t('global.save') }}</v-btn></v-card-actions>
          </v-card>
        </v-dialog>
      </main>
    </div>
  </v-container>
</template>

<script lang="ts">
import { computed, defineComponent, ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import router from '../../router'
import { useI18n } from 'vue-i18n'
import { confirmDestructiveAction } from '../../utils/destructiveConfirmation'
import { handledApiErrorConfig, notifyApiError } from '../../utils/apiFeedback'
const authStore = useAuthStore();

export default defineComponent({
  name: 'ProfilePage',
  setup() {
    const { locale, t } = useI18n()

    
    const availableLanguages = ref([
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
    ])
    
    const user = ref<any>({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      image: '',
      role: null,
      userGroups: [],
      provider: '',
      lastLogin: null,
    })
    const defaultAvatar = '/img/icons/avatar.svg'
    const tokens = ref<any[]>([])
    const editAvatarDialog = ref(false)
    const avatarFile = ref<File | null>(null)
    const editProfileDialog = ref(false)
    const editedUser = ref<any>({ firstName: '', lastName: '', email: '' })
    const changePasswordDialog = ref(false)
    const passwordForm = ref<any>({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const profileError = ref(false)
    const profileErrorMessage = ref('')
    const profileErrorShake = ref(false)
    const passwordError = ref(false)
    const passwordErrorMessage = ref('')
    const passwordErrorShake = ref(false)
    const createDialog = ref(false)
    const tokenDialog = ref(false)
    const generatedToken = ref<any>({ name: '', expiresAt: '', token: '' })
    const newToken = ref<any>({ name: '', expiresAt: '' })
    const textareaFlash = ref(false)
    const createTokenForm = ref<any>(null)
    const requiredRule = (value: string) => !!value || t('profile.token.fieldRequired')

    const loadProfile = async () => {
      try {
        const res = await axios.get('/api/users/profile')
        user.value = res.data
      } catch (e) {
        // fallback or error handling
      }
    }

    const loadTokens = async () => {
      if (!authStore.hasPermission('token:ok') && !authStore.hasPermission('token:write')) {
        tokens.value = []
        return
      }
      
      try {
        const res = await axios.get('/api/tokens/my')
        tokens.value = res.data 
      } catch (e) {
        tokens.value = []
      }
    }

    const deleteToken = async (token: any) => {
      const confirmed = await confirmDestructiveAction({
        title: t('feedback.confirmDelete.title', { name: token.name }),
        text: t('feedback.confirmDelete.message'),
        confirmButtonText: t('global.delete'),
        cancelButtonText: t('global.cancel'),
      })
      if (!confirmed) return

      try {
        await axios.delete(`/api/tokens/my/${token.id}`, handledApiErrorConfig)
        await loadTokens()
      } catch (e) {
        notifyApiError(e, 'deleteToken')
      }
    }

    const saveAvatar = async () => {
      if (!avatarFile.value) return
      const formData = new FormData()
      formData.append('avatar', avatarFile.value)
      try {
        await axios.post('/api/users/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        editAvatarDialog.value = false
        await loadProfile()
      } catch (e) {
        // error handling
      }
    }

    const openEditProfileDialog = () => {
      editedUser.value = {
        firstName: user.value.firstName,
        lastName: user.value.lastName,
        email: user.value.email,
        currentPassword: ''
      }
      profileError.value = false
      editProfileDialog.value = true
    }

    // mismo criterio que el server: sin espacios ni distinción de mayúsculas
    const emailChanged = computed(() =>
      (editedUser.value.email ?? '').trim().toLowerCase() !== (user.value.email ?? '').trim().toLowerCase()
    )

    const saveProfile = async () => {
      try {
        const { currentPassword, ...profile } = editedUser.value
        await axios.put('/api/users/profile', emailChanged.value ? { ...profile, currentPassword } : profile)
        editProfileDialog.value = false
        profileError.value = false
        await loadProfile()
      } catch (e: any) {
        profileError.value = true
        profileErrorMessage.value = e.response?.data?.message || 'Failed to update profile'
        profileErrorShake.value = true
        setTimeout(() => {
          profileErrorShake.value = false
        }, 300)
      }
    }

    const openChangePasswordDialog = () => {
      passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
      passwordError.value = false
      changePasswordDialog.value = true
    }

    const savePassword = async () => {
      if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        return // validation will handle this
      }
      
      try {
        await axios.put('/api/users/profile/password', {
          currentPassword: passwordForm.value.currentPassword,
          newPassword: passwordForm.value.newPassword
        })
        changePasswordDialog.value = false
        passwordError.value = false
        passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
        authStore.reset()
        await router.push('/login')
      } catch (e: any) {
        passwordError.value = true
        passwordErrorMessage.value = e.response?.data?.message || 'Failed to change password'
        passwordErrorShake.value = true
        setTimeout(() => {
          passwordErrorShake.value = false
        }, 300)
      }
    }

    const openCreateDialog = () => {
      newToken.value = { name: '', expiresAt: '', token: '' }
      createDialog.value = true
    }

    const saveCreate = async () => {
      // el datetime-local queda vacío por dentro si no se completa cada segmento
      // (día, hora, minuto...), sin aviso del navegador; esto lo bloquea antes
      // de mandarlo al servidor
      const { valid } = await createTokenForm.value?.validate() ?? { valid: true }
      if (!valid) return

      try {
        const response = await axios.post('/api/tokens/my', newToken.value, handledApiErrorConfig)
        generatedToken.value = response.data
        await loadTokens()
        createDialog.value = false
        tokenDialog.value = true
      } catch (e) {
        notifyApiError(e, 'createToken')
      }
    }

    const copyToken = () => {
      if (generatedToken.value.token) {
        navigator.clipboard.writeText(generatedToken.value.token)
        textareaFlash.value = true
        setTimeout(() => {
          textareaFlash.value = false
        }, 300)
      }
    }

    // Watch for locale changes and save to localStorage
    watch(locale, (newLocale) => {
      localStorage.setItem('kubero.locale', newLocale)
    })

    onMounted(() => {
      loadProfile()
      loadTokens()
    })

    return {
      locale,
      availableLanguages,
      emailChanged,
      user,
      defaultAvatar,
      tokens,
      deleteToken,
      editAvatarDialog,
      avatarFile,
      saveAvatar,
      editProfileDialog,
      editedUser,
      openEditProfileDialog,
      saveProfile,
      changePasswordDialog,
      passwordForm,
      openChangePasswordDialog,
      savePassword,
      createDialog,
      tokenDialog,
      generatedToken,
      newToken,
      openCreateDialog,
      saveCreate,
      copyToken,
      textareaFlash,
      createTokenForm,
      requiredRule,
      authStore,
      profileError,
      profileErrorMessage,
      profileErrorShake,
      passwordError,
      passwordErrorMessage,
      passwordErrorShake,
    }
  },
})
</script>

<style scoped>
.profile-page { max-width: 1280px; padding: 32px 28px 48px; }
.profile-page__header { margin-bottom: 24px; }
.profile-page__header h1 { margin: 0; }
.profile-page__intro, .section-heading p { max-width: 68ch; margin: 6px 0 0; color: rgb(var(--v-theme-on-background)); font-size: .875rem; line-height: 1.55; opacity: .68; }
.profile-layout { display: grid; grid-template-columns: minmax(240px, 292px) minmax(0, 1fr); gap: 24px; align-items: start; }
.identity-panel { position: sticky; top: 24px; overflow: hidden; padding: 28px 24px 24px; border: 1px solid var(--uct-corp-gray-border); border-radius: 8px; color: rgb(var(--v-theme-on-cardBackground)); background: rgb(var(--v-theme-cardBackground)); }
.identity-panel::before { position: absolute; inset: 0 0 auto; height: 4px; background: rgb(var(--v-theme-primary)); content: ''; }
.identity-panel__avatar-wrap { position: relative; width: fit-content; margin-bottom: 20px; }
.identity-panel__avatar { border: 3px solid rgba(var(--v-theme-on-cardBackground), .18); background: rgb(var(--v-theme-secondary)); }
.identity-panel__avatar-action { position: absolute; right: -8px; bottom: 0; border: 2px solid rgb(var(--v-theme-cardBackground)); }
.identity-panel__copy h2 { margin: 0; font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
.identity-panel__username { margin: 6px 0 0; color: rgb(var(--v-theme-primary)); font-family: var(--uct-font-mono); font-size: .8125rem; font-weight: 500; }
.identity-panel__email { overflow-wrap: anywhere; margin: 12px 0 0; color: rgb(var(--v-theme-on-cardBackground)); font-size: .875rem; opacity: .72; }
.identity-panel__badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.identity-panel__divider { margin: 24px 0; opacity: .2; }
.identity-panel :deep(.v-field) { color: rgb(var(--v-theme-on-cardBackground)); background: rgb(var(--v-theme-secondary)); }
.identity-panel :deep(.v-label), .identity-panel :deep(.v-field__outline) { color: rgb(var(--v-theme-on-cardBackground)); opacity: .72; }
.profile-content { display: grid; gap: 24px; min-width: 0; }
.details-panel, .tokens-panel { padding: 24px; }
.section-heading { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
.section-heading h2 { margin: 0; color: rgb(var(--v-theme-on-cardBackground)); font-size: 1rem; font-weight: 600; line-height: 1.4; }
.section-heading__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.details-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; border-top: 1px solid var(--uct-corp-gray-border); border-left: 1px solid var(--uct-corp-gray-border); }
.detail-item { min-width: 0; padding: 18px 20px; border-right: 1px solid var(--uct-corp-gray-border); border-bottom: 1px solid var(--uct-corp-gray-border); }
.detail-item--wide { grid-column: 1 / -1; }
.detail-item dt { margin-bottom: 7px; color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600; letter-spacing: .055em; text-transform: uppercase; opacity: .58; }
.detail-item dd { min-height: 24px; margin: 0; color: rgb(var(--v-theme-on-cardBackground)); font-size: .9375rem; font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }
.detail-item__technical { font-family: var(--uct-font-mono); font-size: .8125rem !important; }
.detail-item__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.tokens-table { border: 1px solid var(--uct-corp-gray-border); border-radius: 8px; background: transparent; }
.tokens-table :deep(th) { color: rgb(var(--v-theme-on-cardBackground)); font-size: .6875rem; font-weight: 600 !important; letter-spacing: .055em; text-transform: uppercase; opacity: .62; }
.tokens-table :deep(tbody tr:last-child td) { border-bottom: 0; }
.tokens-table__name { display: flex; gap: 10px; align-items: center; font-weight: 500; }
.tokens-table__date { font-variant-numeric: tabular-nums; }
.tokens-empty { display: flex; flex-direction: column; gap: 8px; align-items: center; padding: 28px 16px; color: rgb(var(--v-theme-on-cardBackground)); opacity: .58; }
.profile-dialog { overflow: hidden; }
.profile-dialog__title { display: flex; gap: 12px; align-items: center; padding: 20px 24px 12px; font-size: 1rem; font-weight: 600; }
.profile-dialog :deep(.v-card-text) { padding: 16px 24px 4px; }
.profile-dialog :deep(.v-card-actions) { padding: 12px 24px 20px; }

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

.flash {
  animation: flash-animation 3s ease-in-out;
}

@keyframes flash-animation {
  0% { background-color: rgba(237, 197, 0, .28); }
  100% { background-color: transparent; }
}

@media (max-width: 959px) {
  .profile-page { padding: 24px 20px 40px; }
  .profile-layout { grid-template-columns: 1fr; }
  .identity-panel { position: relative; top: auto; display: grid; grid-template-columns: auto 1fr; gap: 0 20px; align-items: center; }
  .identity-panel__avatar-wrap { grid-row: 1 / span 2; margin-bottom: 0; }
  .identity-panel__badges { margin-top: 14px; }
  .identity-panel__divider, .identity-panel > .v-select { grid-column: 1 / -1; }
}

@media (max-width: 599px) {
  .profile-page { padding: 20px 12px 32px; }
  .identity-panel { display: block; padding: 24px 20px 20px; }
  .identity-panel__avatar-wrap { margin-bottom: 18px; }
  .details-panel, .tokens-panel { padding: 20px 16px; }
  .section-heading { display: block; }
  .section-heading__actions, .section-heading > .v-btn { width: 100%; margin-top: 18px; }
  .section-heading__actions :deep(.v-btn), .section-heading > .v-btn { flex: 1 1 100%; }
  .details-grid { grid-template-columns: 1fr; }
  .detail-item--wide { grid-column: auto; }
  .tokens-table { overflow-x: auto; }
  .tokens-table :deep(table) { min-width: 560px; }
}

@media (prefers-reduced-motion: reduce) {
  .shaking, .flash { animation: none; }
}
</style>

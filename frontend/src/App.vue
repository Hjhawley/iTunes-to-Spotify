
<script setup>
import { ref, onMounted } from 'vue'
// Import the SplashScreen API and Capacitor core
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

const user = ref(null)
const file = ref(null)
const status = ref([])

const BACKEND_URL = 'http://localhost:4000'

function loginWithSpotify() {
	window.location.href = `${BACKEND_URL}/auth/login`
}

// Helper to check if we're running natively (iOS/Android)
function isNative() {
	return typeof window !== 'undefined' && window.Capacitor && Capacitor.isNativePlatform()
}

onMounted(async () => {
	try {
		const res = await fetch(`${BACKEND_URL}/auth/whoami`, {
			credentials: 'include'
		})
		if (!res.ok) {
			user.value = null
			// Hide splash only if native
			if (isNative()) await SplashScreen.hide()
			return
		}
		user.value = await res.json()
	} catch {
		user.value = null
	} finally {
		// Hide the splash screen after user check is done (only if native)
		if (isNative()) await SplashScreen.hide()
	}
})

function onFileSelect(event) {
	const chosen = event.target.files?.[0]
	if (chosen && chosen.name.toLowerCase().endsWith('.xml')) {
		file.value = chosen
	} else {
		alert('Please choose an iTunes XML file.')
		event.target.value = ''
		file.value = null
	}
}

async function onSubmit() {
	if (!file.value || !user.value) return
	const form = new FormData()
	form.append('file', file.value)
	status.value.push('Uploading…')

	try {
		const res = await fetch(`${BACKEND_URL}/import`, {
			method: 'POST',
			body: form,
			credentials: 'include'
		})
		const logs = await res.json()
		status.value.push(...logs)
	} catch (err) {
		console.error(err)
		status.value.push('Migration failed. Try again.')
	}
}
</script>

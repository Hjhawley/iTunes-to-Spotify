<script setup>
import { ref, onMounted } from 'vue'

const user = ref(null)
const file = ref(null)
const status = ref([])

// Backend base URL
const BACKEND_URL = 'http://localhost:4000'

// Redirect to backend login
function loginWithSpotify() {
	window.location.href = `${BACKEND_URL}/auth/login`
}

// Check session on mount
onMounted(async () => {
	try {
		const res = await fetch(`${BACKEND_URL}/auth/whoami`, {
			credentials: 'include'
		})
			if (!res.ok) {
			user.value = null
			return
		}
		user.value = await res.json()
	} catch {
		user.value = null
	}
})

// File selection handler
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

// Submit XML to backend import endpoint
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

<template>
<div class="container">
	<h1>iTunes >> Spotify<br/>Playlist Migrator</h1>

	<!-- if not yet authenticated -->
	<div v-if="!user">
	<button @click="loginWithSpotify">Login with Spotify</button>
	</div>

	<!-- once logged in -->
	<div v-else>
	<div class="user-info">
		<img v-if="user.images?.length" :src="user.images[0].url" />
		<p>Logged in as {{ user.display_name }}</p>
	</div>

	<p>Upload your iTunes XML playlist:</p>
	<input
		type="file"
		accept=".xml,text/xml"
		@change="onFileSelect"
	/>

	<div v-if="file">
		<button @click="onSubmit">Migrate to Spotify</button>
		<div class="status-log">
		<p v-for="(msg, i) in status" :key="i">{{ msg }}</p>
		</div>
	</div>
	</div>
</div>
</template>
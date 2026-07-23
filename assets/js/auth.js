import { CLOUDFLARE_PROXY_URL } from './config.js'

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function setFeedback(element, type, message) {
    if (!element) return

    element.textContent = message
    element.className = type ? `form-feedback form-feedback-${type}` : 'form-feedback'
}

function setFieldError(form, fieldName, message) {
    const field = form.querySelector(`[name="${fieldName}"]`)
    const error = form.querySelector(`[data-error-for="${fieldName}"]`)

    if (field) {
        field.setAttribute('aria-invalid', 'true')
    }

    if (error) {
        error.textContent = message
        error.classList.add('is-visible')
    }
}

function clearFieldError(form, fieldName) {
    const field = form.querySelector(`[name="${fieldName}"]`)
    const error = form.querySelector(`[data-error-for="${fieldName}"]`)

    if (field) {
        field.setAttribute('aria-invalid', 'false')
    }

    if (error) {
        error.textContent = ''
        error.classList.remove('is-visible')
    }
}

async function parseJson(response) {
    try {
        return await response.json()
    } catch {
        return null
    }
}

function getUnexpectedResponseErrorMessage(response) {
    const contentType = response?.headers?.get('content-type') || ''

    if (contentType.toLowerCase().includes('text/html')) {
        return 'The server returned an unexpected page. Please refresh the page and try again.'
    }

    return 'The server returned an unexpected response. Please refresh the page and try again.'
}

async function postJson(endpoint, payload) {
    const response = await fetch(`${CLOUDFLARE_PROXY_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })

    const result = await parseJson(response)

    if (result === null) {
        throw new Error(getUnexpectedResponseErrorMessage(response))
    }

    if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || result?.message || `Server responded with ${response.status}`)
    }

    return result
}

export function initManageLogin() {
    const createForm = document.querySelector('[data-auth-create-form]')
    const validateForm = document.querySelector('[data-auth-validate-form]')

    if (!createForm || !validateForm) return

    const emailField = createForm.querySelector('[name="email"]')
    const createSubmit = createForm.querySelector('button[type="submit"]')
    const createFeedback = createForm.querySelector('[data-form-feedback]')
    const codeStep = document.querySelector('[data-auth-step="code"]')
    const codeField = validateForm.querySelector('[name="code"]')
    const validateSubmit = validateForm.querySelector('button[type="submit"]')
    const validateFeedback = validateForm.querySelector('[data-form-feedback]')
    const hiddenEmailField = validateForm.querySelector('[name="email"]')
    const emailSummary = validateForm.querySelector('[data-auth-email-summary]')

    if (!emailField || !createSubmit || !createFeedback || !codeStep || !codeField || !validateSubmit || !validateFeedback || !hiddenEmailField || !emailSummary) {
        return
    }

    createForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearFieldError(createForm, 'email')
        setFeedback(createFeedback, '', '')

        const email = emailField.value.trim()

        if (!email) {
            setFieldError(createForm, 'email', 'Please enter your email address.')
            setFeedback(createFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!isValidEmail(email)) {
            setFieldError(createForm, 'email', 'Please enter a valid email address.')
            setFeedback(createFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        createSubmit.disabled = true
        createSubmit.textContent = 'Sending...'

        try {
            const result = await postJson('create-session', { email })

            hiddenEmailField.value = email
            emailSummary.textContent = `Code sent to ${email}`
            emailField.readOnly = true
            codeStep.classList.remove('is-concealed')
            setFeedback(
                createFeedback,
                'success',
                result?.message || 'A verification code has been sent. Enter it below to continue.'
            )
            window.requestAnimationFrame(() => {
                codeStep.scrollIntoView({ behavior: 'smooth', block: 'start' })
                codeField.focus()
            })
        } catch (error) {
            setFeedback(
                createFeedback,
                'error',
                error.message || 'Unable to start your session. Please try again.'
            )
        } finally {
            createSubmit.disabled = false
            createSubmit.textContent = 'Send code'
        }
    })

    validateForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearFieldError(validateForm, 'code')
        setFeedback(validateFeedback, '', '')

        const email = hiddenEmailField.value.trim()
        const code = codeField.value.trim()

        if (!code) {
            setFieldError(validateForm, 'code', 'Please enter the code from your email.')
            setFeedback(validateFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        validateSubmit.disabled = true
        validateSubmit.textContent = 'Validating...'

        try {
            const result = await postJson('validate-session', { email, code })
            if (result?.data) {
                sessionStorage.setItem('session-token', JSON.stringify(result.data))
            }
            setFeedback(
                validateFeedback,
                'success',
                result?.message || 'Your session has been validated successfully.'
            )
            codeField.value = ''
            window.location.href = '/manage/home.html'
        } catch (error) {
            setFeedback(
                validateFeedback,
                'error',
                error.message || 'Unable to validate your code. Please try again.'
            )
        } finally {
            validateSubmit.disabled = false
            validateSubmit.textContent = 'Verify code'
        }
    })
}

export function initManageHome() {
    const sessionToken = sessionStorage.getItem('session-token')

    if (!sessionToken) {
        window.location.href = '/manage/login.html'
        return
    }

    const logoutButton = document.querySelector('[data-manage-logout]')

    if (logoutButton) {
        logoutButton.addEventListener('click', (event) => {
            event.preventDefault()
            sessionStorage.clear()
            window.location.href = '/manage/login.html'
        })
    }
}

export function initContactForm() {
    const form = document.querySelector('[data-contact-form]')
    if (!form) return

    form.addEventListener('submit', async (e) => {
        e.preventDefault()

        const feedback = form.querySelector('[data-form-feedback]')
        const submitBtn = form.querySelector('button[type="submit"]')

        const data = {
            name: form.querySelector('#contact-name').value.trim(),
            email: form.querySelector('#contact-email').value.trim(),
            message: form.querySelector('#contact-message').value.trim()
        }

        submitBtn.disabled = true
        submitBtn.textContent = 'Sending...'

        try {
            const response = await fetch('https://your-worker.your-subdomain.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            const result = await response.json()

            if (!response.ok || result.ok === false) {
                throw new Error(result.error || 'Server responded with ' + response.status)
            }

            feedback.textContent = 'Your inquiry has been sent successfully.'
            feedback.style.color = '#2e7d32'
            form.reset()
        } catch (error) {
            feedback.textContent = 'Failed to send inquiry. Please try again.'
            feedback.style.color = '#c62828'
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Submit'
        }
    })
}

export function initContactForm() {
    const forms = document.querySelectorAll('[data-remote-submit]')
    if (!forms.length) return

    forms.forEach((form) => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault()

            if (form.querySelector('[aria-invalid="true"]')) {
                return
            }

            const feedback = form.querySelector('[data-form-feedback]')
            const submitBtn = form.querySelector('button[type="submit"]')
            const nameField = form.querySelector('[name="name"]')
            const emailField = form.querySelector('[name="email"]')
            const messageField = form.querySelector('[name="message"]')
            const subjectField = form.querySelector('[name="subject"]')

            if (!nameField || !emailField || !messageField || !subjectField || !submitBtn || !feedback) {
                return
            }

            const data = {
                name: nameField.value.trim(),
                email: emailField.value.trim(),
                message: messageField.value.trim(),
                subject: subjectField.value.trim()
            }

            submitBtn.disabled = true
            submitBtn.textContent = 'Sending...'
            feedback.textContent = ''
            feedback.className = 'form-feedback'

            try {
                const response = await fetch('https://rose-croix-cloudflare-proxy.hantsiowrosecroix.workers.dev/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })

                const result = await response.json()

                if (!response.ok || result.ok === false) {
                    throw new Error(result.error || 'Server responded with ' + response.status)
                }

                feedback.textContent = 'Your inquiry has been sent successfully.'
                feedback.className = 'form-feedback form-feedback-success'
                form.reset()
            } catch (error) {
                feedback.textContent = 'Failed to send inquiry. Please try again.'
                feedback.className = 'form-feedback form-feedback-error'
            } finally {
                submitBtn.disabled = false
                submitBtn.textContent = 'Submit'
            }
        })
    })
}

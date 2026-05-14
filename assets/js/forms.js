function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function initForms() {
    const forms = document.querySelectorAll('[data-contact-form]');

    forms.forEach((form) => {
        const fields = {
            name: form.querySelector('[name="name"]'),
            email: form.querySelector('[name="email"]'),
            message: form.querySelector('[name="message"]'),
        };

        const feedback = form.querySelector('[data-form-feedback]');

        function setError(fieldName, message) {
            const field = fields[fieldName];
            const error = form.querySelector(`[data-error-for="${fieldName}"]`);

            if (!field || !error) {
                return;
            }

            field.setAttribute('aria-invalid', 'true');
            error.textContent = message;
            error.classList.add('is-visible');
        }

        function clearError(fieldName) {
            const field = fields[fieldName];
            const error = form.querySelector(`[data-error-for="${fieldName}"]`);

            if (!field || !error) {
                return;
            }

            field.setAttribute('aria-invalid', 'false');
            error.textContent = '';
            error.classList.remove('is-visible');
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            Object.keys(fields).forEach(clearError);
            let hasError = false;

            if (!fields.name?.value.trim()) {
                setError('name', 'Please enter your full name.');
                hasError = true;
            }

            if (!fields.email?.value.trim()) {
                setError('email', 'Please enter your email address.');
                hasError = true;
            } else if (!isValidEmail(fields.email.value.trim())) {
                setError('email', 'Please enter a valid email address.');
                hasError = true;
            }

            if (!fields.message?.value.trim()) {
                setError('message', 'Please enter a short message.');
                hasError = true;
            }

            if (hasError) {
                if (feedback) {
                    feedback.textContent = 'Please correct the highlighted fields and try again.';
                    feedback.className = 'form-feedback form-feedback-error';
                }
                return;
            }

            if (feedback) {
                feedback.textContent = 'Thank you. Your message has been validated on this page. Please use your District Recorder contact channel to submit it officially.';
                feedback.className = 'form-feedback form-feedback-success';
            }

            form.reset();
        });
    });
}

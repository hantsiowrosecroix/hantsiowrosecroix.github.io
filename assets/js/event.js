import { CLOUDFLARE_PROXY_URL } from './config.js'

const EVENTS_ENDPOINT = 'event'
const DISTRICT_CALENDAR_NAMES = ['Rose Croix Wessex', 'Rose Croix Solent']
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
})

function setFeedback(element, type, message) {
    if (!element) return

    if (!element.dataset.baseClassName) {
        element.dataset.baseClassName = element.className || 'form-feedback'
    }

    element.textContent = message
    element.className = type
        ? `${element.dataset.baseClassName} form-feedback-${type}`
        : element.dataset.baseClassName
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

function getSessionData() {
    const rawValue = sessionStorage.getItem('session-token')

    if (!rawValue) {
        return null
    }

    try {
        return JSON.parse(rawValue)
    } catch {
        return rawValue
    }
}

function getFirstStringValue(source, fieldNames) {
    if (!source || typeof source !== 'object') {
        return ''
    }

    for (const fieldName of fieldNames) {
        const value = source[fieldName]
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }

    return ''
}

function getSessionTokenValue(sessionData) {
    if (!sessionData) {
        return ''
    }

    if (typeof sessionData === 'string') {
        return sessionData.trim()
    }

    return getFirstStringValue(sessionData, ['token', 'sessionToken', 'accessToken', 'jwt'])
}

function buildRequestHeaders(includeJsonBody = false) {
    const headers = {}
    const sessionData = getSessionData()
    const sessionToken = getSessionTokenValue(sessionData)

    if (includeJsonBody) {
        headers['Content-Type'] = 'application/json'
    }

    if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`
    }

    return headers
}

function createEndpointUrl(endpoint, query = {}) {
    const url = new URL(endpoint.replace(/^\//, ''), CLOUDFLARE_PROXY_URL)

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            return
        }

        url.searchParams.set(key, value)
    })

    return url.toString()
}

async function requestJson(endpoint, options = {}) {
    const { method = 'GET', payload, query } = options
    const response = await fetch(createEndpointUrl(endpoint, query), {
        method,
        headers: buildRequestHeaders(Boolean(payload)),
        body: payload ? JSON.stringify(payload) : undefined
    })

    const result = await parseJson(response)

    if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || result?.message || `Server responded with ${response.status}`)
    }

    return result
}

async function getJson(endpoint, query) {
    return requestJson(endpoint, { method: 'GET', query })
}

async function postJson(endpoint, payload) {
    return requestJson(endpoint, { method: 'POST', payload })
}

function getEventCollection(result) {
    if (Array.isArray(result)) {
        return result
    }

    const candidateCollections = [
        result?.data,
        result?.events,
        result?.items,
        result?.data?.events,
        result?.data?.items
    ]

    for (const candidate of candidateCollections) {
        if (Array.isArray(candidate)) {
            return candidate
        }
    }

    return []
}

function getEventDateValue(eventItem, primaryKey, alternateKey) {
    const directValue = eventItem?.[primaryKey]
    if (typeof directValue === 'string' && directValue) {
        return directValue
    }

    const alternateValue = eventItem?.[alternateKey]
    if (typeof alternateValue === 'string' && alternateValue) {
        return alternateValue
    }

    const nestedValue = eventItem?.[primaryKey]?.dateTime || eventItem?.[primaryKey]?.date
    if (typeof nestedValue === 'string' && nestedValue) {
        return nestedValue
    }

    return ''
}

function normalizeEvent(eventItem, calendarName) {
    const startDateTime = getEventDateValue(eventItem, 'start', 'startDateTime')
        || getEventDateValue(eventItem, 'startDate', 'startTime')
    const endDateTime = getEventDateValue(eventItem, 'end', 'endDateTime')
        || getEventDateValue(eventItem, 'endDate', 'endTime')
    const eventId = getFirstStringValue(eventItem, ['id', 'eventId'])
    const title = eventItem?.title || eventItem?.summary || eventItem?.name || 'Untitled event'

    return {
        id: eventId,
        rowKey: eventId || `${calendarName}-${title}-${startDateTime}`,
        calendarName: eventItem?.calendarName || eventItem?.calendar?.name || calendarName,
        title,
        description: eventItem?.description || '',
        location: eventItem?.location || '',
        startDateTime,
        endDateTime
    }
}

function parseDateValue(value) {
    if (!value) {
        return null
    }

    const parsedValue = new Date(value)
    return Number.isNaN(parsedValue.getTime()) ? null : parsedValue
}

function formatEventDate(value) {
    const parsedValue = parseDateValue(value)
    return parsedValue ? dateTimeFormatter.format(parsedValue) : 'Date unavailable'
}

function formatDateTimeLocalValue(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getDefaultEventDates() {
    const startDate = new Date()
    startDate.setMinutes(0, 0, 0)
    startDate.setHours(startDate.getHours() + 1)

    const endDate = new Date(startDate)
    endDate.setHours(endDate.getHours() + 1)

    return {
        startDateTime: formatDateTimeLocalValue(startDate),
        endDateTime: formatDateTimeLocalValue(endDate)
    }
}

function setEventFormDefaults(form, calendarName = DISTRICT_CALENDAR_NAMES[0]) {
    const calendarField = form.querySelector('[name="calendarName"]')
    const startField = form.querySelector('[name="startDateTime"]')
    const endField = form.querySelector('[name="endDateTime"]')
    const defaultDates = getDefaultEventDates()

    if (calendarField) {
        calendarField.value = calendarName
    }

    if (startField) {
        startField.value = defaultDates.startDateTime
    }

    if (endField) {
        endField.value = defaultDates.endDateTime
    }
}

function getEventFormValues(form) {
    return {
        id: form.querySelector('[name="eventId"]')?.value.trim() || '',
        originalCalendarName: form.querySelector('[name="originalCalendarName"]')?.value.trim() || '',
        calendarName: form.querySelector('[name="calendarName"]')?.value.trim() || '',
        title: form.querySelector('[name="title"]')?.value.trim() || '',
        description: form.querySelector('[name="description"]')?.value.trim() || '',
        location: form.querySelector('[name="location"]')?.value.trim() || '',
        startDateTime: form.querySelector('[name="startDateTime"]')?.value || '',
        endDateTime: form.querySelector('[name="endDateTime"]')?.value || ''
    }
}

function buildCreatePayload(formValues, startDate, endDate) {
    return {
        calendarName: formValues.calendarName,
        title: formValues.title,
        description: formValues.description,
        location: formValues.location,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString()
    }
}

function buildUpdatePayload(formValues, startDate, endDate) {
    const payload = {
        subMethodType: 'PUT',
        id: formValues.id,
        originalCalendarName: formValues.originalCalendarName,
        calendarName: formValues.calendarName,
        title: formValues.title,
        description: formValues.description,
        location: formValues.location,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString()
    }

    if (!payload.originalCalendarName) {
        delete payload.originalCalendarName
    }

    return payload
}

function buildDeletePayload(eventItem) {
    return {
        subMethodType: 'DELETE',
        id: eventItem.id,
        originalCalendarName: eventItem.calendarName,
        calendarName: eventItem.calendarName
    }
}

function createActionButton(type, label) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `event-action-button ${type === 'delete' ? 'event-action-delete' : ''}`.trim()
    button.setAttribute('aria-label', label)
    button.title = label

    if (type === 'edit') {
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
        `
    } else {
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18"></path>
                <path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
            </svg>
        `
    }

    return button
}

function createTableCell(label, content) {
    const cell = document.createElement('td')
    cell.setAttribute('data-label', label)

    if (typeof content === 'string') {
        cell.textContent = content
    } else {
        cell.appendChild(content)
    }

    return cell
}

function createEventRow(eventItem, handlers) {
    const row = document.createElement('tr')
    row.dataset.eventId = eventItem.id
    row.dataset.calendarName = eventItem.calendarName

    const details = document.createElement('div')

    const title = document.createElement('p')
    title.className = 'event-title-text'
    title.textContent = eventItem.title
    details.appendChild(title)

    if (eventItem.location) {
        const location = document.createElement('p')
        location.className = 'event-meta-text'
        location.textContent = `Location: ${eventItem.location}`
        details.appendChild(location)
    }

    if (eventItem.description) {
        const description = document.createElement('p')
        description.className = 'event-description-text'
        description.textContent = eventItem.description
        details.appendChild(description)
    }

    const startCellContent = document.createElement('p')
    startCellContent.className = 'event-date-text'
    startCellContent.textContent = formatEventDate(eventItem.startDateTime)

    const endCellContent = document.createElement('p')
    endCellContent.className = 'event-date-text'
    endCellContent.textContent = formatEventDate(eventItem.endDateTime)

    const actions = document.createElement('div')
    actions.className = 'events-actions'

    const editButton = createActionButton('edit', `Edit ${eventItem.title}`)
    const deleteButton = createActionButton('delete', `Delete ${eventItem.title}`)

    if (!eventItem.id) {
        editButton.disabled = true
        deleteButton.disabled = true

        const note = document.createElement('p')
        note.className = 'event-meta-text'
        note.textContent = 'Event id unavailable for edit/delete actions.'
        actions.appendChild(note)
    } else {
        editButton.addEventListener('click', () => {
            handlers.onEdit(eventItem)
        })

        deleteButton.addEventListener('click', (event) => {
            handlers.onDelete(eventItem, event.currentTarget)
        })

        actions.append(editButton, deleteButton)
    }

    row.appendChild(createTableCell('Event', details))
    row.appendChild(createTableCell('Starts', startCellContent))
    row.appendChild(createTableCell('Ends', endCellContent))
    row.appendChild(createTableCell('Actions', actions))

    return row
}

function renderTableMessage(container, message, rowClassName) {
    container.replaceChildren()

    const row = document.createElement('tr')
    row.className = rowClassName

    const cell = document.createElement('td')
    cell.colSpan = 4
    cell.textContent = message

    row.appendChild(cell)
    container.appendChild(row)
}

function renderCalendarEvents(container, events, calendarName, handlers) {
    container.replaceChildren()

    if (!events.length) {
        renderTableMessage(container, `No events found for ${calendarName}.`, 'events-empty-row')
        return
    }

    const sortedEvents = [...events].sort((leftEvent, rightEvent) => {
        const leftDate = parseDateValue(leftEvent.startDateTime)?.getTime() || 0
        const rightDate = parseDateValue(rightEvent.startDateTime)?.getTime() || 0
        return leftDate - rightDate
    })

    const fragment = document.createDocumentFragment()

    sortedEvents.forEach((eventItem) => {
        fragment.appendChild(createEventRow(eventItem, handlers))
    })

    container.appendChild(fragment)
}

async function loadCalendarEvents(statusElement, listContainers, state, handlers) {
    setFeedback(statusElement, '', 'Loading calendar events...')

    for (const calendarName of DISTRICT_CALENDAR_NAMES) {
        const listContainer = listContainers.get(calendarName)

        if (!listContainer) {
            continue
        }

        renderTableMessage(listContainer, 'Loading events...', 'events-empty-row')
    }

    const results = await Promise.allSettled(
        DISTRICT_CALENDAR_NAMES.map((calendarName) => getJson(EVENTS_ENDPOINT, { calendarName }))
    )

    let hadFailure = false

    results.forEach((result, index) => {
        const calendarName = DISTRICT_CALENDAR_NAMES[index]
        const listContainer = listContainers.get(calendarName)

        if (!listContainer) {
            return
        }

        if (result.status === 'fulfilled') {
            const events = getEventCollection(result.value).map((eventItem) => normalizeEvent(eventItem, calendarName))
            state.eventsByCalendar.set(calendarName, events)
            renderCalendarEvents(listContainer, events, calendarName, handlers)
            return
        }

        hadFailure = true
        state.eventsByCalendar.set(calendarName, [])
        renderTableMessage(
            listContainer,
            result.reason?.message || `Unable to load events for ${calendarName}.`,
            'events-error-row'
        )
    })

    setFeedback(
        statusElement,
        hadFailure ? 'error' : 'success',
        hadFailure
            ? 'Some calendar events could not be loaded. Please review the messages below.'
            : 'Calendar events are up to date.'
    )
}

function clearEventFormValidation(form, formFeedback, deleteFeedback) {
    clearFieldError(form, 'title')
    clearFieldError(form, 'startDateTime')
    clearFieldError(form, 'endDateTime')
    setFeedback(formFeedback, '', '')
    setFeedback(deleteFeedback, '', '')
}

function setCreateMode(state, elements, preferredCalendarName = DISTRICT_CALENDAR_NAMES[0]) {
    state.mode = 'create'
    state.editingEvent = null

    elements.createForm.reset()
    setEventFormDefaults(elements.createForm, preferredCalendarName)
    elements.eventIdField.value = ''
    elements.originalCalendarNameField.value = ''
    elements.formShell.classList.remove('is-editing')
    elements.formMode.textContent = 'Create'
    elements.formTitle.textContent = 'Create a calendar event'
    elements.formSummary.textContent = 'Use this form to add a new event to either district calendar.'
    elements.submitButton.textContent = 'Create event'
    elements.cancelEditButton.classList.add('is-hidden')
}

function setEditMode(state, elements, eventItem) {
    state.mode = 'edit'
    state.editingEvent = eventItem

    elements.eventIdField.value = eventItem.id
    elements.originalCalendarNameField.value = eventItem.calendarName
    elements.calendarField.value = eventItem.calendarName
    elements.titleField.value = eventItem.title
    elements.descriptionField.value = eventItem.description
    elements.locationField.value = eventItem.location
    elements.startField.value = parseDateValue(eventItem.startDateTime)
        ? formatDateTimeLocalValue(new Date(eventItem.startDateTime))
        : ''
    elements.endField.value = parseDateValue(eventItem.endDateTime)
        ? formatDateTimeLocalValue(new Date(eventItem.endDateTime))
        : ''

    elements.formShell.classList.add('is-editing')
    elements.formMode.textContent = 'Edit'
    elements.formTitle.textContent = 'Edit calendar event'
    elements.formSummary.textContent = `Updating "${eventItem.title}". Save to send a PUT request for this event.`
    elements.submitButton.textContent = 'Update event'
    elements.cancelEditButton.classList.remove('is-hidden')

    window.requestAnimationFrame(() => {
        elements.createForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
        elements.titleField.focus()
        elements.titleField.select()
    })
}

function openDeleteModal(state, elements, eventItem, triggerElement) {
    state.deletingEvent = eventItem
    state.deleteTriggerElement = triggerElement || null

    elements.deleteMessage.textContent = `Delete "${eventItem.title}" from ${eventItem.calendarName}? This cannot be undone.`
    setFeedback(elements.deleteFeedback, '', '')
    elements.deleteConfirmButton.disabled = false
    elements.deleteConfirmButton.textContent = 'Delete event'
    elements.deleteModal.classList.remove('is-hidden')
    elements.deleteModal.setAttribute('aria-hidden', 'false')
    document.body.classList.add('events-modal-open')
}

function closeDeleteModal(state, elements, options = {}) {
    const { restoreFocus = true } = options

    state.deletingEvent = null
    elements.deleteModal.classList.add('is-hidden')
    elements.deleteModal.setAttribute('aria-hidden', 'true')
    setFeedback(elements.deleteFeedback, '', '')
    document.body.classList.remove('events-modal-open')

    if (restoreFocus && state.deleteTriggerElement instanceof HTMLElement) {
        state.deleteTriggerElement.focus()
    }

    state.deleteTriggerElement = null
}

export function initManageEvents() {
    const createForm = document.querySelector('[data-events-create-form]')
    const refreshButton = document.querySelector('[data-events-refresh]')
    const formFeedback = createForm?.querySelector('[data-form-feedback]')
    const eventsStatus = document.querySelector('[data-events-status]')
    const deleteModal = document.querySelector('[data-events-delete-modal]')
    const deleteMessage = document.querySelector('[data-events-delete-message]')
    const deleteFeedback = document.querySelector('[data-events-delete-feedback]')
    const deleteConfirmButton = document.querySelector('[data-events-delete-confirm]')
    const deleteCancelButton = document.querySelector('[data-events-delete-cancel]')
    const deleteCloseElements = document.querySelectorAll('[data-events-close-delete-modal]')

    if (!createForm || !formFeedback || !eventsStatus || !deleteModal || !deleteMessage || !deleteFeedback || !deleteConfirmButton || !deleteCancelButton) {
        return
    }

    const listContainers = new Map(
        DISTRICT_CALENDAR_NAMES.map((calendarName) => [
            calendarName,
            document.querySelector(`[data-events-list="${calendarName}"]`)
        ])
    )

    const elements = {
        createForm,
        formShell: createForm,
        formFeedback,
        eventsStatus,
        calendarField: createForm.querySelector('[name="calendarName"]'),
        titleField: createForm.querySelector('[name="title"]'),
        descriptionField: createForm.querySelector('[name="description"]'),
        locationField: createForm.querySelector('[name="location"]'),
        startField: createForm.querySelector('[name="startDateTime"]'),
        endField: createForm.querySelector('[name="endDateTime"]'),
        eventIdField: createForm.querySelector('[name="eventId"]'),
        originalCalendarNameField: createForm.querySelector('[name="originalCalendarName"]'),
        submitButton: createForm.querySelector('[data-events-submit]'),
        cancelEditButton: createForm.querySelector('[data-events-cancel-edit]'),
        formMode: createForm.querySelector('[data-events-form-mode]'),
        formTitle: createForm.querySelector('[data-events-form-title]'),
        formSummary: createForm.querySelector('[data-events-form-summary]'),
        deleteModal,
        deleteMessage,
        deleteFeedback,
        deleteConfirmButton
    }

    if (
        !elements.calendarField
        || !elements.titleField
        || !elements.descriptionField
        || !elements.locationField
        || !elements.startField
        || !elements.endField
        || !elements.eventIdField
        || !elements.originalCalendarNameField
        || !elements.submitButton
        || !elements.cancelEditButton
        || !elements.formMode
        || !elements.formTitle
        || !elements.formSummary
    ) {
        return
    }

    const state = {
        mode: 'create',
        editingEvent: null,
        deletingEvent: null,
        deleteTriggerElement: null,
        eventsByCalendar: new Map()
    }

    const refreshEvents = async () => {
        await loadCalendarEvents(eventsStatus, listContainers, state, {
            onEdit: (eventItem) => {
                clearEventFormValidation(createForm, formFeedback, deleteFeedback)
                setEditMode(state, elements, eventItem)
            },
            onDelete: (eventItem, triggerElement) => {
                openDeleteModal(state, elements, eventItem, triggerElement)
            }
        })
    }

    clearEventFormValidation(createForm, formFeedback, deleteFeedback)
    setCreateMode(state, elements)

    createForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearEventFormValidation(createForm, formFeedback, deleteFeedback)

        const formValues = getEventFormValues(createForm)
        const startDate = parseDateValue(formValues.startDateTime)
        const endDate = parseDateValue(formValues.endDateTime)

        if (!formValues.title) {
            setFieldError(createForm, 'title', 'Please enter an event title.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!startDate) {
            setFieldError(createForm, 'startDateTime', 'Please enter a valid start date and time.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!endDate) {
            setFieldError(createForm, 'endDateTime', 'Please enter a valid end date and time.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (endDate < startDate) {
            setFieldError(createForm, 'endDateTime', 'The end time must be the same as or after the start time.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (state.mode === 'edit' && !formValues.id) {
            setFeedback(formFeedback, 'error', 'This event is missing its id, so it cannot be updated.')
            return
        }

        const isEditing = state.mode === 'edit'
        const payload = isEditing
            ? buildUpdatePayload(formValues, startDate, endDate)
            : buildCreatePayload(formValues, startDate, endDate)

        elements.submitButton.disabled = true
        elements.submitButton.textContent = isEditing ? 'Updating event...' : 'Creating event...'

        try {
            const result = await postJson(EVENTS_ENDPOINT, payload)
            const selectedCalendar = formValues.calendarName || DISTRICT_CALENDAR_NAMES[0]

            setCreateMode(state, elements, selectedCalendar)
            setFeedback(
                formFeedback,
                'success',
                result?.message || (isEditing
                    ? 'The calendar event was updated successfully.'
                    : 'The calendar event was created successfully.')
            )
            await refreshEvents()
        } catch (error) {
            setFeedback(
                formFeedback,
                'error',
                error.message || (isEditing
                    ? 'Unable to update the calendar event. Please try again.'
                    : 'Unable to create the calendar event. Please try again.')
            )
        } finally {
            elements.submitButton.disabled = false
            elements.submitButton.textContent = state.mode === 'edit' ? 'Update event' : 'Create event'
        }
    })

    elements.cancelEditButton.addEventListener('click', () => {
        clearEventFormValidation(createForm, formFeedback, deleteFeedback)
        setCreateMode(state, elements, elements.calendarField.value || DISTRICT_CALENDAR_NAMES[0])
    })

    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true
            refreshButton.textContent = 'Refreshing...'

            try {
                await refreshEvents()
            } finally {
                refreshButton.disabled = false
                refreshButton.textContent = 'Refresh events'
            }
        })
    }

    deleteCancelButton.addEventListener('click', () => {
        closeDeleteModal(state, elements)
    })

    deleteCloseElements.forEach((element) => {
        element.addEventListener('click', () => {
            closeDeleteModal(state, elements)
        })
    })

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !deleteModal.classList.contains('is-hidden')) {
            closeDeleteModal(state, elements)
        }
    })

    deleteConfirmButton.addEventListener('click', async () => {
        if (!state.deletingEvent?.id) {
            setFeedback(deleteFeedback, 'error', 'This event is missing its id, so it cannot be deleted.')
            return
        }

        deleteConfirmButton.disabled = true
        deleteConfirmButton.textContent = 'Deleting event...'
        setFeedback(deleteFeedback, '', '')

        try {
            const result = await postJson(EVENTS_ENDPOINT, buildDeletePayload(state.deletingEvent))
            const deletedEventId = result?.data?.id || state.deletingEvent.id
            const deletedCalendarName = result?.data?.calendarName || state.deletingEvent.calendarName

            closeDeleteModal(state, elements, { restoreFocus: false })

            if (state.editingEvent?.id === deletedEventId) {
                setCreateMode(state, elements, deletedCalendarName || DISTRICT_CALENDAR_NAMES[0])
            }

            setFeedback(
                formFeedback,
                'success',
                result?.message || 'The calendar event was deleted successfully.'
            )
            await refreshEvents()
        } catch (error) {
            setFeedback(
                deleteFeedback,
                'error',
                error.message || 'Unable to delete the calendar event. Please try again.'
            )
        } finally {
            deleteConfirmButton.disabled = false
            deleteConfirmButton.textContent = 'Delete event'
        }
    })

    refreshEvents()
}

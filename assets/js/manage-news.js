import { CLOUDFLARE_PROXY_URL } from './config.js'

const NEWS_ENDPOINT = 'news'
const NEWS_PAGE_SIZE = 100
const DEFAULT_TABLE_PAGE_SIZE = 5
const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
]
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
})
const dateOnlyFormatter = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
})

function setFeedback(element, type, message) {
    if (!element) {
        return
    }

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

function getUnexpectedResponseErrorMessage(response) {
    const contentType = response?.headers?.get('content-type') || ''

    if (contentType.toLowerCase().includes('text/html')) {
        return 'The server returned an unexpected page. Please refresh the page and try again.'
    }

    return 'The server returned an unexpected response. Please refresh the page and try again.'
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

    if (result === null) {
        throw new Error(getUnexpectedResponseErrorMessage(response))
    }

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

function parseTimestamp(value) {
    const normalized = String(value ?? '').trim()

    if (!normalized) {
        return null
    }

    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseDateOnly(value, endOfDay = false) {
    const normalized = String(value ?? '').trim()
    const match = normalized.match(DATE_ONLY_PATTERN)

    if (!match) {
        return null
    }

    const year = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const day = Number(match[3])
    const parsed = endOfDay
        ? new Date(year, monthIndex, day, 23, 59, 59, 999)
        : new Date(year, monthIndex, day, 0, 0, 0, 0)

    if (
        parsed.getFullYear() !== year
        || parsed.getMonth() !== monthIndex
        || parsed.getDate() !== day
    ) {
        return null
    }

    return parsed
}

function formatPublishedDate(value) {
    const parsed = parseTimestamp(value)
    return parsed ? timestampFormatter.format(parsed) : 'Unavailable'
}

function formatExpiryDate(value) {
    const parsed = parseDateOnly(value)
    return parsed ? dateOnlyFormatter.format(parsed) : 'No expiry'
}

function normalizeNewsItem(item) {
    return {
        id: String(item?.id ?? '').trim(),
        timestamp: String(item?.timestamp ?? '').trim(),
        title: String(item?.title ?? '').trim(),
        month: String(item?.month ?? '').trim(),
        year: String(item?.year ?? '').trim(),
        expire_on: String(item?.expire_on ?? '').trim(),
        news: String(item?.news ?? '').trim()
    }
}

function getSortTime(item) {
    return (
        parseTimestamp(item.timestamp)?.getTime()
        || parseDateOnly(item.expire_on, true)?.getTime()
        || 0
    )
}

async function fetchAllNews() {
    const allItems = []
    let page = 1

    while (page <= 50) {
        const result = await getJson(NEWS_ENDPOINT, { page, pageSize: NEWS_PAGE_SIZE })
        const items = Array.isArray(result?.data) ? result.data : []

        allItems.push(...items.map(normalizeNewsItem))

        if (!result?.pagination?.hasMore || !items.length) {
            break
        }

        page += 1
    }

    return allItems
}

function getDefaultNewsValues() {
    const now = new Date()

    return {
        month: MONTH_NAMES[now.getMonth()],
        year: String(now.getFullYear()),
        expire_on: ''
    }
}

function getNewsFormValues(form) {
    return {
        id: form.querySelector('[name="newsId"]')?.value.trim() || '',
        title: form.querySelector('[name="title"]')?.value.trim() || '',
        month: form.querySelector('[name="month"]')?.value.trim() || '',
        year: form.querySelector('[name="year"]')?.value.trim() || '',
        expire_on: form.querySelector('[name="expire_on"]')?.value.trim() || '',
        news: form.querySelector('[name="news"]')?.value.trim() || ''
    }
}

function buildCreatePayload(formValues) {
    return {
        title: formValues.title,
        month: formValues.month,
        year: formValues.year,
        expire_on: formValues.expire_on,
        news: formValues.news
    }
}

function buildUpdatePayload(formValues) {
    return {
        subMethodType: 'PUT',
        id: formValues.id,
        title: formValues.title,
        month: formValues.month,
        year: formValues.year,
        expire_on: formValues.expire_on,
        news: formValues.news
    }
}

function buildDeletePayload(newsItem) {
    return {
        subMethodType: 'DELETE',
        id: newsItem.id
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

function createSkeletonBlock(className) {
    const block = document.createElement('div')
    block.className = `news-skeleton ${className}`.trim()
    block.setAttribute('aria-hidden', 'true')
    return block
}

function createNewsSkeletonRow() {
    const row = document.createElement('tr')
    row.className = 'manage-table-skeleton-row'
    row.setAttribute('aria-hidden', 'true')

    const details = document.createElement('div')
    details.className = 'manage-table-skeleton-stack'
    details.append(
        createSkeletonBlock('manage-table-skeleton-title'),
        createSkeletonBlock('manage-table-skeleton-meta'),
        createSkeletonBlock('manage-table-skeleton-line'),
        createSkeletonBlock('manage-table-skeleton-line manage-table-skeleton-line-short')
    )

    const published = createSkeletonBlock('manage-table-skeleton-date')
    const expires = createSkeletonBlock('manage-table-skeleton-date')

    const actions = document.createElement('div')
    actions.className = 'manage-table-skeleton-actions'
    actions.append(
        createSkeletonBlock('manage-table-skeleton-action'),
        createSkeletonBlock('manage-table-skeleton-action')
    )

    row.appendChild(createTableCell('Article', details))
    row.appendChild(createTableCell('Published', published))
    row.appendChild(createTableCell('Expires', expires))
    row.appendChild(createTableCell('Actions', actions))

    return row
}

function renderNewsSkeletonRows(container, count) {
    container.replaceChildren()

    const fragment = document.createDocumentFragment()
    const rowCount = Math.max(count || DEFAULT_TABLE_PAGE_SIZE, 1)

    for (let index = 0; index < rowCount; index += 1) {
        fragment.appendChild(createNewsSkeletonRow())
    }

    container.appendChild(fragment)
}

function createNewsRow(newsItem, handlers) {
    const row = document.createElement('tr')
    row.dataset.newsId = newsItem.id

    const details = document.createElement('div')

    const title = document.createElement('p')
    title.className = 'event-title-text'
    title.textContent = newsItem.title || 'Untitled article'
    details.appendChild(title)

    const period = document.createElement('p')
    period.className = 'event-meta-text'
    period.textContent = `${newsItem.month || 'Unknown month'} ${newsItem.year || ''}`.trim()
    details.appendChild(period)

    if (newsItem.news) {
        const body = document.createElement('p')
        body.className = 'event-description-text'
        body.style.whiteSpace = 'pre-line'
        body.textContent = newsItem.news
        details.appendChild(body)
    }

    const published = document.createElement('p')
    published.className = 'event-date-text'
    published.textContent = formatPublishedDate(newsItem.timestamp)

    const expires = document.createElement('p')
    expires.className = 'event-date-text'
    expires.textContent = formatExpiryDate(newsItem.expire_on)

    const actions = document.createElement('div')
    actions.className = 'events-actions'

    const editButton = createActionButton('edit', `Edit ${newsItem.title || 'article'}`)
    const deleteButton = createActionButton('delete', `Delete ${newsItem.title || 'article'}`)

    if (!newsItem.id) {
        editButton.disabled = true
        deleteButton.disabled = true

        const note = document.createElement('p')
        note.className = 'event-meta-text'
        note.textContent = 'Article id unavailable for edit/delete actions.'
        actions.appendChild(note)
    } else {
        editButton.addEventListener('click', () => {
            handlers.onEdit(newsItem)
        })

        deleteButton.addEventListener('click', (event) => {
            handlers.onDelete(newsItem, event.currentTarget)
        })

        actions.append(editButton, deleteButton)
    }

    row.appendChild(createTableCell('Article', details))
    row.appendChild(createTableCell('Published', published))
    row.appendChild(createTableCell('Expires', expires))
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

function normalizeSearchTerm(value) {
    return String(value ?? '').trim().toLowerCase()
}

function clampPageNumber(currentPage, totalPages) {
    return Math.min(Math.max(currentPage || 1, 1), Math.max(totalPages, 1))
}

function getPaginatedItems(items, currentPage, pageSize) {
    const safePageSize = pageSize || DEFAULT_TABLE_PAGE_SIZE
    const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
    const safeCurrentPage = clampPageNumber(currentPage, totalPages)
    const startIndex = (safeCurrentPage - 1) * safePageSize

    return {
        pageItems: items.slice(startIndex, startIndex + safePageSize),
        currentPage: safeCurrentPage,
        pageSize: safePageSize,
        totalPages,
        startIndex
    }
}

function updateTableControls(controls, options) {
    if (!controls) {
        return
    }

    const {
        searchTerm = '',
        pageSize = DEFAULT_TABLE_PAGE_SIZE,
        currentPage = 1,
        totalPages = 1,
        totalItems = 0,
        visibleStart = 0,
        visibleEnd = 0,
        loading = false
    } = options

    if (controls.searchField) {
        controls.searchField.value = searchTerm
    }

    if (controls.pageSizeField) {
        controls.pageSizeField.value = String(pageSize)
    }

    if (controls.paginationStatus) {
        controls.paginationStatus.textContent = loading
            ? 'Loading articles...'
            : totalItems
            ? `Showing ${visibleStart}-${visibleEnd} of ${totalItems} articles • Page ${currentPage} of ${totalPages}`
            : 'Showing 0 articles'
    }

    if (controls.prevButton) {
        controls.prevButton.disabled = loading || currentPage <= 1 || totalItems === 0
    }

    if (controls.nextButton) {
        controls.nextButton.disabled = loading || currentPage >= totalPages || totalItems === 0
    }
}

function renderNewsList(container, newsItems, handlers, controls, tableView) {
    container.replaceChildren()

    const sortedItems = [...newsItems].sort((left, right) => getSortTime(right) - getSortTime(left))
    const normalizedSearchTerm = normalizeSearchTerm(tableView?.searchTerm)
    const filteredItems = normalizedSearchTerm
        ? sortedItems.filter((newsItem) => normalizeSearchTerm(newsItem.title).includes(normalizedSearchTerm))
        : sortedItems
    const pagination = getPaginatedItems(filteredItems, tableView?.currentPage, tableView?.pageSize)

    if (tableView) {
        tableView.currentPage = pagination.currentPage
    }

    if (!filteredItems.length) {
        renderTableMessage(
            container,
            normalizedSearchTerm
                ? `No news articles match "${tableView.searchTerm}".`
                : 'No news articles found.',
            'events-empty-row'
        )
        updateTableControls(controls, {
            searchTerm: tableView?.searchTerm,
            pageSize: pagination.pageSize,
            currentPage: pagination.currentPage,
            totalPages: pagination.totalPages,
            totalItems: 0,
            visibleStart: 0,
            visibleEnd: 0
        })
        return
    }

    const fragment = document.createDocumentFragment()

    pagination.pageItems.forEach((newsItem) => {
        fragment.appendChild(createNewsRow(newsItem, handlers))
    })

    container.appendChild(fragment)
    updateTableControls(controls, {
        searchTerm: tableView?.searchTerm,
        pageSize: pagination.pageSize,
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalItems: filteredItems.length,
        visibleStart: pagination.startIndex + 1,
        visibleEnd: pagination.startIndex + pagination.pageItems.length
    })
}

async function loadNews(statusElement, listContainer, controls, state, handlers) {
    setFeedback(statusElement, '', 'Loading news articles...')
    renderNewsSkeletonRows(listContainer, state.tableView.pageSize)
    updateTableControls(controls, {
        searchTerm: state.tableView.searchTerm,
        pageSize: state.tableView.pageSize,
        totalItems: 0,
        visibleStart: 0,
        visibleEnd: 0,
        loading: true
    })

    try {
        const newsItems = await fetchAllNews()
        state.newsItems = newsItems
        renderNewsList(listContainer, newsItems, handlers, controls, state.tableView)
        setFeedback(statusElement, 'success', 'News articles are up to date.')
    } catch (error) {
        state.newsItems = []
        renderTableMessage(
            listContainer,
            error.message || 'Unable to load news articles.',
            'events-error-row'
        )
        updateTableControls(controls, {
            searchTerm: state.tableView.searchTerm,
            pageSize: state.tableView.pageSize,
            totalItems: 0,
            visibleStart: 0,
            visibleEnd: 0
        })
        setFeedback(statusElement, 'error', 'News articles could not be loaded. Please review the message below.')
    }
}

function clearNewsFormValidation(form, formFeedback, deleteFeedback) {
    clearFieldError(form, 'title')
    clearFieldError(form, 'month')
    clearFieldError(form, 'year')
    clearFieldError(form, 'expire_on')
    clearFieldError(form, 'news')
    setFeedback(formFeedback, '', '')
    setFeedback(deleteFeedback, '', '')
}

function setNewsFormDefaults(elements) {
    const defaults = getDefaultNewsValues()
    elements.monthField.value = defaults.month
    elements.yearField.value = defaults.year
    elements.expireOnField.value = defaults.expire_on
}

function setCreateMode(state, elements) {
    state.mode = 'create'
    state.editingNews = null

    elements.createForm.reset()
    setNewsFormDefaults(elements)
    elements.newsIdField.value = ''
    elements.formShell.classList.remove('is-editing')
    elements.formMode.textContent = 'Create'
    elements.formTitle.textContent = 'Create a news article'
    elements.formSummary.textContent = 'Use this form to add a new article to the Latest News page.'
    elements.submitButton.textContent = 'Create article'
    elements.cancelEditButton.classList.add('is-hidden')
}

function setEditMode(state, elements, newsItem) {
    state.mode = 'edit'
    state.editingNews = newsItem

    elements.newsIdField.value = newsItem.id
    elements.titleField.value = newsItem.title
    elements.monthField.value = MONTH_NAMES.includes(newsItem.month) ? newsItem.month : getDefaultNewsValues().month
    elements.yearField.value = newsItem.year
    elements.expireOnField.value = newsItem.expire_on
    elements.newsField.value = newsItem.news

    elements.formShell.classList.add('is-editing')
    elements.formMode.textContent = 'Edit'
    elements.formTitle.textContent = 'Edit a news article'
    elements.formSummary.textContent = `Updating "${newsItem.title}". Save to send a PUT request for this article.`
    elements.submitButton.textContent = 'Update article'
    elements.cancelEditButton.classList.remove('is-hidden')

    window.requestAnimationFrame(() => {
        elements.createForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
        elements.titleField.focus()
        elements.titleField.select()
    })
}

function openDeleteModal(state, elements, newsItem, triggerElement) {
    state.deletingNews = newsItem
    state.deleteTriggerElement = triggerElement || null

    elements.deleteMessage.textContent = `Delete "${newsItem.title}"? This cannot be undone.`
    setFeedback(elements.deleteFeedback, '', '')
    elements.deleteConfirmButton.disabled = false
    elements.deleteConfirmButton.textContent = 'Delete article'
    elements.deleteModal.classList.remove('is-hidden')
    elements.deleteModal.setAttribute('aria-hidden', 'false')
    document.body.classList.add('events-modal-open')
}

function closeDeleteModal(state, elements, options = {}) {
    const { restoreFocus = true } = options

    state.deletingNews = null
    elements.deleteModal.classList.add('is-hidden')
    elements.deleteModal.setAttribute('aria-hidden', 'true')
    setFeedback(elements.deleteFeedback, '', '')
    document.body.classList.remove('events-modal-open')

    if (restoreFocus && state.deleteTriggerElement instanceof HTMLElement) {
        state.deleteTriggerElement.focus()
    }

    state.deleteTriggerElement = null
}

function isValidYear(value) {
    return /^\d{4}$/.test(value)
}

function isValidDateOnly(value) {
    return Boolean(parseDateOnly(value))
}

export function initManageNews() {
    const createForm = document.querySelector('[data-news-create-form]')
    const refreshButton = document.querySelector('[data-news-refresh]')
    const formFeedback = createForm?.querySelector('[data-form-feedback]')
    const newsStatus = document.querySelector('[data-news-status]')
    const listContainer = document.querySelector('[data-news-list]')
    const newsControls = {
        searchField: document.querySelector('[data-news-search]'),
        pageSizeField: document.querySelector('[data-news-page-size]'),
        paginationStatus: document.querySelector('[data-news-pagination-status]'),
        prevButton: document.querySelector('[data-news-prev-page]'),
        nextButton: document.querySelector('[data-news-next-page]')
    }
    const deleteModal = document.querySelector('[data-news-delete-modal]')
    const deleteMessage = document.querySelector('[data-news-delete-message]')
    const deleteFeedback = document.querySelector('[data-news-delete-feedback]')
    const deleteConfirmButton = document.querySelector('[data-news-delete-confirm]')
    const deleteCancelButton = document.querySelector('[data-news-delete-cancel]')
    const deleteCloseElements = document.querySelectorAll('[data-news-close-delete-modal]')

    if (
        !createForm
        || !formFeedback
        || !newsStatus
        || !listContainer
        || !deleteModal
        || !deleteMessage
        || !deleteFeedback
        || !deleteConfirmButton
        || !deleteCancelButton
    ) {
        return
    }

    const elements = {
        createForm,
        formShell: createForm,
        formFeedback,
        newsStatus,
        listContainer,
        titleField: createForm.querySelector('[name="title"]'),
        monthField: createForm.querySelector('[name="month"]'),
        yearField: createForm.querySelector('[name="year"]'),
        expireOnField: createForm.querySelector('[name="expire_on"]'),
        newsField: createForm.querySelector('[name="news"]'),
        newsIdField: createForm.querySelector('[name="newsId"]'),
        submitButton: createForm.querySelector('[data-news-submit]'),
        cancelEditButton: createForm.querySelector('[data-news-cancel-edit]'),
        formMode: createForm.querySelector('[data-news-form-mode]'),
        formTitle: createForm.querySelector('[data-news-form-title]'),
        formSummary: createForm.querySelector('[data-news-form-summary]'),
        deleteModal,
        deleteMessage,
        deleteFeedback,
        deleteConfirmButton
    }

    if (
        !elements.titleField
        || !elements.monthField
        || !elements.yearField
        || !elements.expireOnField
        || !elements.newsField
        || !elements.newsIdField
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
        editingNews: null,
        deletingNews: null,
        deleteTriggerElement: null,
        newsItems: [],
        tableView: {
            searchTerm: '',
            pageSize: DEFAULT_TABLE_PAGE_SIZE,
            currentPage: 1
        }
    }

    const refreshNews = async () => {
        await loadNews(newsStatus, listContainer, newsControls, state, {
            onEdit: (newsItem) => {
                clearNewsFormValidation(createForm, formFeedback, deleteFeedback)
                setEditMode(state, elements, newsItem)
            },
            onDelete: (newsItem, triggerElement) => {
                openDeleteModal(state, elements, newsItem, triggerElement)
            }
        })
    }

    clearNewsFormValidation(createForm, formFeedback, deleteFeedback)
    setCreateMode(state, elements)

    const rerenderNews = () => {
        renderNewsList(listContainer, state.newsItems, {
            onEdit: (newsItem) => {
                clearNewsFormValidation(createForm, formFeedback, deleteFeedback)
                setEditMode(state, elements, newsItem)
            },
            onDelete: (newsItem, triggerElement) => {
                openDeleteModal(state, elements, newsItem, triggerElement)
            }
        }, newsControls, state.tableView)
    }

    newsControls.searchField?.addEventListener('input', () => {
        state.tableView.searchTerm = newsControls.searchField.value.trim()
        state.tableView.currentPage = 1
        rerenderNews()
    })

    newsControls.pageSizeField?.addEventListener('change', () => {
        const parsedPageSize = Number.parseInt(newsControls.pageSizeField.value, 10)
        state.tableView.pageSize = Number.isInteger(parsedPageSize) ? parsedPageSize : DEFAULT_TABLE_PAGE_SIZE
        state.tableView.currentPage = 1
        rerenderNews()
    })

    newsControls.prevButton?.addEventListener('click', () => {
        state.tableView.currentPage -= 1
        rerenderNews()
    })

    newsControls.nextButton?.addEventListener('click', () => {
        state.tableView.currentPage += 1
        rerenderNews()
    })

    createForm.addEventListener('submit', async (event) => {
        event.preventDefault()
        clearNewsFormValidation(createForm, formFeedback, deleteFeedback)

        const formValues = getNewsFormValues(createForm)
        const isEditing = state.mode === 'edit'

        if (!formValues.title) {
            setFieldError(createForm, 'title', 'Please enter an article title.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!formValues.month) {
            setFieldError(createForm, 'month', 'Please choose the display month.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!isValidYear(formValues.year)) {
            setFieldError(createForm, 'year', 'Please enter a four-digit year.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!formValues.expire_on) {
            setFieldError(createForm, 'expire_on', 'Please enter an expiry date.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!isValidDateOnly(formValues.expire_on)) {
            setFieldError(createForm, 'expire_on', 'Please enter a valid expiry date.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (!formValues.news) {
            setFieldError(createForm, 'news', 'Please enter the article body.')
            setFeedback(formFeedback, 'error', 'Please correct the highlighted field and try again.')
            return
        }

        if (isEditing && !formValues.id) {
            setFeedback(formFeedback, 'error', 'This article is missing its id, so it cannot be updated.')
            return
        }

        const payload = isEditing
            ? buildUpdatePayload(formValues)
            : buildCreatePayload(formValues)

        elements.submitButton.disabled = true
        elements.submitButton.textContent = isEditing ? 'Updating article...' : 'Creating article...'

        try {
            const result = await postJson(NEWS_ENDPOINT, payload)

            setCreateMode(state, elements)
            setFeedback(
                formFeedback,
                'success',
                result?.message || (isEditing
                    ? 'The news article was updated successfully.'
                    : 'The news article was created successfully.')
            )
            await refreshNews()
        } catch (error) {
            setFeedback(
                formFeedback,
                'error',
                error.message || (isEditing
                    ? 'Unable to update the news article. Please try again.'
                    : 'Unable to create the news article. Please try again.')
            )
        } finally {
            elements.submitButton.disabled = false
            elements.submitButton.textContent = state.mode === 'edit' ? 'Update article' : 'Create article'
        }
    })

    elements.cancelEditButton.addEventListener('click', () => {
        clearNewsFormValidation(createForm, formFeedback, deleteFeedback)
        setCreateMode(state, elements)
    })

    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true
            refreshButton.textContent = 'Refreshing...'

            try {
                await refreshNews()
            } finally {
                refreshButton.disabled = false
                refreshButton.textContent = 'Refresh articles'
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
        if (!state.deletingNews?.id) {
            setFeedback(deleteFeedback, 'error', 'This article is missing its id, so it cannot be deleted.')
            return
        }

        deleteConfirmButton.disabled = true
        deleteConfirmButton.textContent = 'Deleting article...'
        setFeedback(deleteFeedback, '', '')

        try {
            const result = await postJson(NEWS_ENDPOINT, buildDeletePayload(state.deletingNews))
            const deletedNewsId = result?.data?.id || state.deletingNews.id

            closeDeleteModal(state, elements, { restoreFocus: false })

            if (state.editingNews?.id === deletedNewsId) {
                setCreateMode(state, elements)
            }

            setFeedback(
                formFeedback,
                'success',
                result?.message || 'The news article was deleted successfully.'
            )
            await refreshNews()
        } catch (error) {
            setFeedback(
                deleteFeedback,
                'error',
                error.message || 'Unable to delete the news article. Please try again.'
            )
        } finally {
            deleteConfirmButton.disabled = false
            deleteConfirmButton.textContent = 'Delete article'
        }
    })

    refreshNews()
}

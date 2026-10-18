import { post, remove, request } from '../../../shared/services/apiService'

const listResources = (mine = false) => request({ path: `/v1/resources${mine ? '?mine=true' : ''}` })
const getResource = (id) => request({ path: `/v1/resources/${encodeURIComponent(id)}` })
const saveResource = (value) => post('/v1/resources', value)
const deleteResource = (id) => remove(`/v1/resources/${encodeURIComponent(id)}`)
const toggleHeart = (id) => post(`/v1/resources/${encodeURIComponent(id)}/heart`)
const reportResource = (id, reason) => post(`/v1/resources/${encodeURIComponent(id)}/report`, { reason })
const listCollegePosts = () => request({ path: '/v1/college-posts' })
const saveCollegePost = (value) => post('/v1/college-posts', value)
const deleteCollegePost = (id) => remove(`/v1/college-posts/${encodeURIComponent(id)}`)
const reportCollegePost = (id, reason) => post(`/v1/college-posts/${encodeURIComponent(id)}/report`, { reason })

export { deleteCollegePost, deleteResource, getResource, listCollegePosts, listResources, reportCollegePost, reportResource, saveCollegePost, saveResource, toggleHeart }

export const getCourseResourceCount = (courseId) => request({ path: `/v1/courses/${encodeURIComponent(courseId)}/resource-count` })

class ApiResponse {
    constructor(statusCode, message = "Request successful", data) {
        this.statusCode = statusCode
        this.message = message
        this.success = statusCode < 400
        this.data = data
    }
}
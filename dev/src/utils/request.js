import axios from 'axios'
import Vue from 'vue'
import store from '../store/index'


const service = axios.create({
    baseURL: "https://api.github.com",
    timeout: 15000
})

service.interceptors.request.use(
    config => {
        let token = store.state.token.token
        // let token = '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'
        // Vue.prototype.$message({
        //     message: token ,
        //     type: 'info'
        // })
        
        if (token) {
            let sp = "?"
            if (token.type === "Bearer") {
                sp = "&"
            }
            // config.url = config.url +'/user',
            config.headers.Authorization = 'Bearer ' + token
            

        }
        return config
    },
    error => {
        return Promise.reject(error)
    }
)



service.interceptors.response.use(
    response => {
        let responseJson = response.data
        return response
    },
    error => {
        let message
        switch (error.response.status) {
            case 401:
                message = "Token错误"
                break
            default:
                message = error.response.data.message
                break
        }
        Vue.prototype.$message({
            message: message,
            type: 'error'
        })
        return Promise.reject('error')
    }
)

export default service

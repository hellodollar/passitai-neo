/** 登录、注册与账户资料修改共用的输入校验规则。 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 至少包含字母和数字，6-20 位。 */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,20}$/

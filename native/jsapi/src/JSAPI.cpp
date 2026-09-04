// 书阁原生模块注册：只注册 fs 模块。
// 不注册 custom（笔上已有原生 custom.scan，重复注册同一模块名会冲突）。
//
// 基于 miniapp-template 的 JSAPI 骨架（GPL-3.0-or-later，作者 Langning Chen）。
// SPDX-License-Identifier: GPL-3.0-or-later

#include "JSAPI.hpp"
#include "FileSystem.hpp"

#include <jsmodules/JSCModuleExtension.h>
#include <quickjs/quickjs.h>

#include <cstring>

extern "C" JQUICK_EXPORT void custom_init_jsapis()
{
    registerCModuleLoader("fs", &fs_module_load);
}

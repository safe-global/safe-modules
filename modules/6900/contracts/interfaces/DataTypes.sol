// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

enum ManifestAssociatedFunctionType {
    NONE,
    SELF,
    DEPENDENCY,
    RUNTIME_VALIDATION_ALWAYS_ALLOW,
    PRE_HOOK_ALWAYS_DENY
}

struct ManifestFunction {
    ManifestAssociatedFunctionType functionType;
    uint8 functionId;
    uint256 dependencyIndex;
}

struct ManifestAssociatedFunction {
    bytes4 executionSelector;
    ManifestFunction associatedFunction;
}

struct ManifestExecutionHook {
    bytes4 selector;
    ManifestFunction preExecHook;
    ManifestFunction postExecHook;
}

struct ManifestExternalCallPermission {
    address externalAddress;
    bool permitAnySelector;
    bytes4[] selectors;
}

struct SelectorPermission {
    bytes4 functionSelector;
    string permissionDescription;
}

struct PluginMetadata {
    string name;
    string version;
    string author;
    SelectorPermission[] permissionDescriptors;
}

struct PluginManifest {
    bytes4[] interfaceIds;
    bytes4[] dependencyInterfaceIds;
    bytes4[] executionFunctions;
    bytes4[] permittedExecutionSelectors;
    bool permitAnyExternalAddress;
    bool canSpendNativeToken;
    ManifestExternalCallPermission[] permittedExternalCalls;
    ManifestAssociatedFunction[] userOpValidationFunctions;
    ManifestAssociatedFunction[] runtimeValidationFunctions;
    ManifestAssociatedFunction[] preUserOpValidationHooks;
    ManifestAssociatedFunction[] preRuntimeValidationHooks;
    ManifestExecutionHook[] executionHooks;
}

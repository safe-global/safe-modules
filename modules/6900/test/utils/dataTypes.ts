import { ethers } from "hardhat";

export const getPluginManifest = (pluginManifest: Partial<PluginManifest> = {}): string => {
    const abi = ethers.AbiCoder.defaultAbiCoder();

    // Encoding the PluginManifest according to its structure
    const encoded = abi.encode(["tuple(bytes4[],bytes4[],bytes4[],bytes4[],bool,bool,tuple(address,bool,bytes4[])[],tuple(bytes4,tuple(uint8,uint8,uint256))[],tuple(bytes4,tuple(uint8,uint8,uint256))[],tuple(bytes4,tuple(uint8,uint8,uint256))[],tuple(bytes4,tuple(uint8,uint8,uint256))[],tuple(bytes4,tuple(uint8,uint8,uint256),tuple(uint8,uint8,uint256))[])"],
        [
            [pluginManifest.interfaceIds || [],
            pluginManifest.dependencyInterfaceIds || [],
            pluginManifest.executionFunctions || [],
            pluginManifest.permittedExecutionSelectors || [],
            pluginManifest.permitAnyExternalAddress || false,
            pluginManifest.canSpendNativeToken || false,
            pluginManifest.permittedExternalCalls?.map(call => [call.externalAddress, call.permitAnySelector, call.selectors]) || [],
            pluginManifest.userOpValidationFunctions?.map(func => [func.executionSelector, [func.associatedFunction.functionType, func.associatedFunction.functionId, func.associatedFunction.dependencyIndex]]) || [],
            pluginManifest.runtimeValidationFunctions?.map(func => [func.executionSelector, [func.associatedFunction.functionType, func.associatedFunction.functionId, func.associatedFunction.dependencyIndex]]) || [],
            pluginManifest.preUserOpValidationHooks?.map(func => [func.executionSelector, [func.associatedFunction.functionType, func.associatedFunction.functionId, func.associatedFunction.dependencyIndex]]) || [],
            pluginManifest.preRuntimeValidationHooks?.map(func => [func.executionSelector, [func.associatedFunction.functionType, func.associatedFunction.functionId, func.associatedFunction.dependencyIndex]]) || [],
            pluginManifest.executionHooks?.map(hook => [
                hook.selector,
                [hook.preExecHook.functionType, hook.preExecHook.functionId, hook.preExecHook.dependencyIndex],
                [hook.postExecHook.functionType, hook.postExecHook.functionId, hook.postExecHook.dependencyIndex]
            ]) || []
            ]]
    );

    return encoded;
}

export enum ManifestAssociatedFunctionType {
    NONE,
    SELF,
    DEPENDENCY,
    RUNTIME_VALIDATION_ALWAYS_ALLOW,
    PRE_HOOK_ALWAYS_DENY
}

export interface ManifestFunction {
    functionType: ManifestAssociatedFunctionType;
    functionId: number; // uint8 in Solidity
    dependencyIndex: bigint; // uint256 in Solidity
}

export interface ManifestAssociatedFunction {
    executionSelector: string; // bytes4 in Solidity
    associatedFunction: ManifestFunction;
}

export interface ManifestExecutionHook {
    selector: string; // bytes4 in Solidity
    preExecHook: ManifestFunction;
    postExecHook: ManifestFunction;
}

export interface ManifestExternalCallPermission {
    externalAddress: string; // address in Solidity
    permitAnySelector: boolean;
    selectors: string[]; // bytes4[] in Solidity
}

export interface SelectorPermission {
    functionSelector: string; // bytes4 in Solidity
    permissionDescription: string;
}

export interface PluginMetadata {
    name: string;
    version: string;
    author: string;
    permissionDescriptors: SelectorPermission[];
}

export interface PluginManifest {
    interfaceIds: string[]; // bytes4[] in Solidity
    dependencyInterfaceIds: string[]; // bytes4[] in Solidity
    executionFunctions: string[]; // bytes4[] in Solidity
    permittedExecutionSelectors: string[]; // bytes4[] in Solidity
    permitAnyExternalAddress: boolean;
    canSpendNativeToken: boolean;
    permittedExternalCalls: ManifestExternalCallPermission[];
    userOpValidationFunctions: ManifestAssociatedFunction[];
    runtimeValidationFunctions: ManifestAssociatedFunction[];
    preUserOpValidationHooks: ManifestAssociatedFunction[];
    preRuntimeValidationHooks: ManifestAssociatedFunction[];
    executionHooks: ManifestExecutionHook[];
}
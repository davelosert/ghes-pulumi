import * as fs from 'node:fs';
import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as compute from '@pulumi/azure-native/compute';
import * as network from '@pulumi/azure-native/network';


const config = new pulumi.Config();

// Create an Azure Resource Group
const ghesNamePrefix = 'test-ghes';
const adminUsername = config.require('adminUser');
const sshPubKeyPath = config.require('sshPubKeyPath');

const sshPubKey = fs.readFileSync(sshPubKeyPath, 'utf8');

const resourceGroup = new resources.ResourceGroup(`${ghesNamePrefix}-pulumi`);
const securityGroup = new network.NetworkSecurityGroup(`${ghesNamePrefix}-nsg`, {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  securityRules: [
    {
      name: 'Git over SSH',
      access: network.Access.Allow,
      direction: network.AccessRuleDirection.Inbound,
      protocol: network.SecurityRuleProtocol.Asterisk,
      destinationPortRange: '22',
      destinationAddressPrefix: '*',
      sourcePortRange: '*',
      sourceAddressPrefix: '*',
      priority: 900
    },
    {
      name: 'Web application access',
      access: network.Access.Allow,
      direction: network.AccessRuleDirection.Inbound,
      protocol: network.SecurityRuleProtocol.Asterisk,
      destinationPortRange: '80',
      destinationAddressPrefix: '*',
      sourcePortRange: '*',
      sourceAddressPrefix: '*',
      priority: 800
    },
    {
      name: 'Instance SSH shell access',
      access: network.Access.Allow,
      direction: network.AccessRuleDirection.Inbound,
      protocol: network.SecurityRuleProtocol.Asterisk,
      destinationPortRange: '122',
      destinationAddressPrefix: '*',
      sourcePortRange: '*',
      sourceAddressPrefix: '*',
      priority: 700
    },
    {
      name: 'Web application and Git over https',
      access: network.Access.Allow,
      direction: network.AccessRuleDirection.Inbound,
      protocol: network.SecurityRuleProtocol.Asterisk,
      destinationPortRange: '443',
      destinationAddressPrefix: '*',
      sourcePortRange: '*',
      sourceAddressPrefix: '*',
      priority: 600
    },
    {
      name: 'Secure web based management console',
      access: network.Access.Allow,
      direction: network.AccessRuleDirection.Inbound,
      protocol: network.SecurityRuleProtocol.Asterisk,
      destinationPortRange: '8443',
      destinationAddressPrefix: '*',
      sourcePortRange: '*',
      sourceAddressPrefix: '*',
      priority: 500
    },
  ]  
});
const virtualNetwork = new network.VirtualNetwork(`${ghesNamePrefix}-network`, {
  resourceGroupName: resourceGroup.name,
  addressSpace: { addressPrefixes: ['10.0.0.0/16']},
  subnets: [{
    name: 'default',
    addressPrefix: '10.0.0.0/24',
    networkSecurityGroup: {
      id: securityGroup.id
    }
  }],
});

// Add VM
const ghesVmInstance = new compute.VirtualMachine(`${ghesNamePrefix}-vm`, {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  hardwareProfile: {
    vmSize: 'Standard_D4ds_v4',
  },
  networkProfile: {
    networkApiVersion: compute.NetworkApiVersion.NetworkApiVersion_2020_11_01,
    networkInterfaceConfigurations: [{
      name: `${ghesNamePrefix}-nic`,
      ipConfigurations: [{
        name: `${ghesNamePrefix}-nic-config`,
        subnet: {
          id: virtualNetwork.subnets[0].id
        },
        publicIPAddressConfiguration: {
          name: `${ghesNamePrefix}-nice-publicip`,
          dnsSettings: {
            domainNameLabel: ghesNamePrefix
          },
          publicIPAddressVersion: compute.IPVersions.IPv4,
          publicIPAllocationMethod: compute.PublicIPAllocationMethod.Static,
          sku: {
            name: compute.PublicIPAddressSkuName.Basic,
            tier: compute.PublicIPAddressSkuTier.Regional
          },
        },
      }]
    }]
  },
  osProfile: {
    computerName: `${ghesNamePrefix}`,
    adminUsername,
    linuxConfiguration: {
      disablePasswordAuthentication: true,
      ssh: {
        publicKeys: [{
            keyData: sshPubKey,
            path: `/home/${adminUsername}/.ssh/authorized_keys`
          }]
      }
    }
  },
  storageProfile: {
    imageReference: {
      offer: 'GitHub-Enterprise',
      publisher: 'GitHub',
      sku: 'GitHub-Enterprise',
      version: '3.4.2'
    },
    osDisk: {
      createOption: compute.DiskCreateOption.FromImage,
      managedDisk: {
        storageAccountType: compute.StorageAccountType.Premium_LRS
      }
    },
    dataDisks: [
      {
        name: `${ghesNamePrefix}-datadisk`,
        caching: compute.CachingTypes.ReadWrite,
        createOption: compute.DiskCreateOption.Empty,
        lun: 2,
        diskSizeGB: 150,
        managedDisk: {
          storageAccountType: compute.StorageAccountType.Premium_LRS
        }
      }
    ]
  },
});


export const resourceGroupName = resourceGroup.name;
export const physicalName = ghesVmInstance.name;

export const { dns, ip } = pulumi.all([resourceGroup.name, ghesVmInstance.networkProfile]).apply(async ([rg, profile]) => {
  const ipName = profile?.networkInterfaceConfigurations![0].ipConfigurations[0].publicIPAddressConfiguration?.name;
  const ip = await network.getPublicIPAddress({
    resourceGroupName: rg,
    publicIpAddressName: ipName!
  });
  
  return {
    dns: ip.dnsSettings?.fqdn,
    ip: ip.ipAddress!
  }
});
